// Turns custom-elements.json (from `cem analyze`) into:
//   - vscode.html-custom-data.json: tag/attribute autocomplete and hover
//     docs in VS Code's HTML editor (and other editors that read the
//     format). Add it to the `html.customData` setting.
//   - src/<module>/index.d.mts: a TypeScript declaration for each element
//     class, plus a global HTMLElementTagNameMap entry, so
//     `document.querySelector("tabbed-ui")` is typed.
//   - src/<module>/global.d.mts: lets `import ".../global.mjs"` bring in
//     those types too.
// Every output is generated, committed, and checked for drift in CI; edit
// the JSDoc in the element's index.mjs instead.
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = "https://github.com/johnhenry/pixelable/tree/main";
const GENERATED = "// Generated from custom-elements.json by scripts/manifest-outputs.mjs.\n// Do not edit: change the JSDoc in index.mjs and run `npm run manifest`.\n";
const VALID_TAG = /^[a-z][a-z0-9]*-[a-z0-9-]*$/;

const manifest = JSON.parse(await readFile(join(ROOT, "custom-elements.json"), "utf8"));
// The analyzer emits modules in file-system order, which varies between
// runs; sort so the committed manifest is reproducible (CI checks drift).
manifest.modules.sort((a, b) => a.path.localeCompare(b.path));

// Say which module registers each tag, as the manifest format intends (a
// `custom-element-definition` export), so tools can load just the element
// they need: an element's sibling global.mjs. The analyzer only sees
// `customElements.define(name, …)` calls with a runtime name, which it
// reports as definitions of a tag called "name"; drop those.
for (const mod of manifest.modules) {
  if (!mod.exports) continue;
  mod.exports = mod.exports.filter((e) => e.kind !== "custom-element-definition" || VALID_TAG.test(e.name));
}
for (const mod of [...manifest.modules]) {
  for (const d of mod.declarations ?? []) {
    if (!d.customElement || !VALID_TAG.test(d.tagName ?? "")) continue;
    const globalPath = join(dirname(mod.path), "global.mjs");
    const exists = await readFile(join(ROOT, globalPath), "utf8").then(() => true, () => false);
    if (!exists) continue;
    manifest.modules.push({
      kind: "javascript-module",
      path: globalPath,
      declarations: [],
      exports: [{ kind: "custom-element-definition", name: d.tagName, declaration: { name: d.name, module: mod.path } }],
    });
  }
}
manifest.modules.sort((a, b) => a.path.localeCompare(b.path));
await writeFile(join(ROOT, "custom-elements.json"), JSON.stringify(manifest, null, 2) + "\n");

const elements = manifest.modules.flatMap((mod) =>
  (mod.declarations ?? [])
    .filter((d) => d.customElement && VALID_TAG.test(d.tagName ?? ""))
    .map((declaration) => ({ path: mod.path, declaration })),
);

const doc = (text, indent = "") =>
  text ? `${indent}/** ${text.replace(/\*\//g, "*\\/").replace(/\n/g, `\n${indent} * `)} */\n` : "";

// --- VS Code custom data -------------------------------------------------
const customData = {
  version: 1.1,
  tags: elements.map(({ path, declaration: d }) => ({
    name: d.tagName,
    description: [d.summary ?? d.description, d.events?.length ? `Events: ${d.events.map((e) => `\`${e.name}\``).join(", ")}` : ""]
      .filter(Boolean)
      .join("\n\n"),
    attributes: (d.attributes ?? []).map((a) => ({
      name: a.name,
      description: a.description,
      ...(a.type?.text === "boolean" ? { valueSet: "v" } : {}),
    })),
    references: [{ name: "Documentation", url: `${REPO}/${dirname(path)}` }],
  })),
};
await writeFile(join(ROOT, "vscode.html-custom-data.json"), JSON.stringify(customData, null, 2) + "\n");

// --- TypeScript declarations ---------------------------------------------
const tsType = (text) => (text ? text.replace(/\bobject\b/g, "Record<string, unknown>") : "unknown");

for (const { path, declaration: d } of elements) {
  const className = d.name && d.name !== "default" ? d.name : "Element";
  // Lifecycle callbacks (connectedCallback, formResetCallback, …) are called
  // by the browser, not users, so they're left out like in lib.dom.d.ts.
  const members = (d.members ?? []).filter(
    (m) => (m.privacy ?? "public") === "public" && !m.static && !/Callback$/.test(m.name),
  );
  const body = members
    .map((m) => {
      if (m.kind === "method") {
        const ident = (name) => /^[A-Za-z_$][\w$]*$/.test(name);
        // The analyzer lists a destructured parameter twice: as written in
        // code ("{ focus = true }") and as its JSDoc @param. Keep the JSDoc one.
        const params = (m.parameters ?? [])
          .filter((p, i, all) => ident(p.name) || !(all[i + 1] && ident(all[i + 1].name) && all[i + 1].type))
          .map((p, i) => {
            // Destructured parameters ("{ focus = true }") need a plain name.
            const name = /^[A-Za-z_$][\w$]*$/.test(p.name) ? p.name : i ? `options${i}` : "options";
            const optional = p.optional || p.default !== undefined || /=/.test(p.name);
            return `${name}${optional ? "?" : ""}: ${tsType(p.type?.text)}`;
          })
          .join(", ");
        return `${doc(m.description, "  ")}  ${m.name}(${params}): ${tsType(m.return?.type?.text ?? "void")};`;
      }
      return `${doc(m.description, "  ")}  ${m.readonly ? "readonly " : ""}${m.name}: ${tsType(m.type?.text)};`;
    })
    .join("\n");
  // Named exports of constants (TOKEN_TYPES, DEFAULT_STRINGS, …).
  const mod = manifest.modules.find((m) => m.path === path);
  const constants = (mod.exports ?? [])
    .filter((e) => e.kind === "js" && e.name !== "default" && e.declaration?.module === path)
    .map((e) => mod.declarations.find((v) => v.kind === "variable" && v.name === e.declaration.name))
    .filter(Boolean)
    .map((v) => `${doc(v.description)}export declare const ${v.name}: ${tsType(v.type?.text)};\n`)
    .join("");
  const dts =
    GENERATED +
    "\n" +
    (constants ? constants + "\n" : "") +
    doc(d.description ?? d.summary) +
    `export default class ${className} extends HTMLElement {\n${body}\n}\n\n` +
    `declare global {\n  interface HTMLElementTagNameMap {\n    "${d.tagName}": ${className};\n  }\n}\n`;
  await writeFile(join(ROOT, path.replace(/\.mjs$/, ".d.mts")), dts);
  await writeFile(
    join(ROOT, dirname(path), "global.d.mts"),
    `${GENERATED}// Registers <${d.tagName}>; see ./index.d.mts for its type.\nimport "./index.mjs";\nexport {};\n`,
  );
}

// --- API tables: docs/reference.md and each element README ------------------
const cell = (text) => (text ?? "").replace(/\|/g, "\\|").replace(/\n+/g, " ").trim();
const code = (text) => (text ? `\`${text.replace(/\|/g, "\\|")}\`` : "");
const table = (head, rows) =>
  rows.length ? `| ${head.join(" | ")} |\n|${head.map(() => "---").join("|")}|\n${rows.map((r) => `| ${r.join(" | ")} |`).join("\n")}` : "";
const ident = (name) => /^[A-Za-z_$][\w$]*$/.test(name);
const kebab = (name) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

// The tables for one element, each under `heading(title)`.
function apiTables(d, heading) {
  const members = (d.members ?? []).filter(
    (m) => (m.privacy ?? "public") === "public" && !m.static && !/Callback$/.test(m.name),
  );
  const properties = members.filter((m) => m.kind === "field");
  const methods = members.filter((m) => m.kind === "method");
  const mirrored = new Set(properties.map((m) => kebab(m.name)));
  // A property with no description of its own that mirrors an attribute.
  const describe = (m) =>
    cell(m.description) ||
    (d.attributes?.some((a) => a.name === kebab(m.name)) ? `Mirrors the \`${kebab(m.name)}\` attribute.` : "");
  return [
    d.attributes?.length
      ? heading("Attributes") +
        table(
          ["Attribute", "Property", "Type", "Description"],
          d.attributes.map((a) => [
            code(a.name),
            mirrored.has(a.name) ? code(a.name.replace(/-([a-z])/g, (_, c) => c.toUpperCase())) : "",
            code(a.type?.text),
            cell(a.description),
          ]),
        )
      : "",
    properties.length
      ? heading("Properties") +
        table(["Property", "Type", "Description"], properties.map((m) => [code(m.name) + (m.readonly ? " (read-only)" : ""), code(m.type?.text), describe(m)]))
      : "",
    methods.length
      ? heading("Methods") +
        table(["Method", "Description"], methods.map((m) => {
          const params = (m.parameters ?? [])
            .filter((p, i, all) => ident(p.name) || !(all[i + 1] && ident(all[i + 1].name) && all[i + 1].type))
            .map((p, i) => (ident(p.name) ? p.name : i ? `options${i}` : "options"));
          return [code(`${m.name}(${params.join(", ")})`), cell(m.description)];
        }))
      : "",
    d.events?.length ? heading("Events") + table(["Event", "Description"], d.events.map((e) => [code(e.name), cell(e.description)])) : "",
    d.cssProperties?.length
      ? heading("CSS custom properties") + table(["Property", "Description"], d.cssProperties.map((c) => [code(c.name), cell(c.description)]))
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

// Each element README carries a generated API section between these
// markers; the hand-written prose around it stays the author's.
const START = "<!-- api:start (generated from custom-elements.json by `npm run manifest`; edit the JSDoc instead) -->";
const END = "<!-- api:end -->";
const missingMarkers = [];
for (const { path, declaration: d } of elements) {
  const readme = join(ROOT, dirname(path), "readme.md");
  const text = await readFile(readme, "utf8");
  const a = text.indexOf("<!-- api:start");
  const b = text.indexOf(END);
  if (a < 0 || b < a) {
    missingMarkers.push(relative(ROOT, readme));
    continue;
  }
  const body = apiTables(d, (title) => `### ${title}\n\n`);
  await writeFile(readme, `${text.slice(0, a)}${START}\n\n${body}\n\n${text.slice(b)}`);
}
if (missingMarkers.length) {
  console.error(`✖ element README(s) without an <!-- api:start --> … ${END} block: ${missingMarkers.join(", ")}`);
  process.exitCode = 1;
}

const sections = [...elements]
  .sort((a, b) => a.declaration.tagName.localeCompare(b.declaration.tagName))
  .map(({ path, declaration: d }) => {
    const dir = dirname(path);
    return [
      `## \`<${d.tagName}>\``,
      `${cell(d.summary ?? d.description)} [Guide](../${dir}/readme.md) · module \`@johnhenry/pixelable/${dir.replace(/^src\//, "")}\``,
      apiTables(d, (title) => `**${title}**\n\n`),
    ].join("\n\n");
  });
await writeFile(
  join(ROOT, "docs/reference.md"),
  `<!-- Generated from custom-elements.json by scripts/manifest-outputs.mjs. Do not edit: change the JSDoc and run \`npm run manifest\`. -->\n\n` +
    `# Element reference\n\nEvery stable element's attributes, properties, methods, events, and CSS custom properties, generated from the code. Each element's guide (linked) explains how to use it.\n\n` +
    sections.join("\n\n") +
    "\n",
);

console.log(
  `✅ ${elements.length} element(s): ${elements.map((e) => e.declaration.tagName).join(", ")} -> vscode.html-custom-data.json, ${elements
    .map((e) => relative(ROOT, join(ROOT, e.path.replace(/\.mjs$/, ".d.mts"))))
    .join(", ")}`,
);
