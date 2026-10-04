// Every path this repo *tells* someone to use must exist. Checks:
//   1. relative `import`/`from`/`src=`/`href=` references in src/ and demo/
//      (.mjs/.html/.htm) resolve to a real file;
//   2. relative Markdown links in every .md file resolve to a real file;
//   3. every `@johnhenry/canvas-fx/<subpath>` mentioned anywhere (README
//      snippets, CDN URLs, import examples) resolves through package.json's
//      own "exports" map to a real file.
// Renames have broken all three kinds of reference before (stale CDN paths
// in readmes after 0.0.4, dangling gallery iframes) -- nothing else in the
// test suite would notice.
import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SKIP_DIRS = new Set(["node_modules", ".git"]);

const walk = async (dir) => {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const p = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(p)));
    else files.push(p);
  }
  return files;
};

const exists = async (p) => {
  try {
    return (await stat(p)).isFile();
  } catch {
    return false;
  }
};

const isDir = async (p) => {
  try {
    return (await stat(p)).isDirectory();
  } catch {
    return false;
  }
};

// Minimal implementation of Node's subpath-pattern resolution, enough for
// this package's own "exports" map: exact keys first, then the pattern key
// with the longest prefix, ties broken by the longer key.
const pkg = JSON.parse(await readFile(join(ROOT, "package.json"), "utf8"));
const resolveExport = (subpath) => {
  const key = `./${subpath}`;
  if (typeof pkg.exports[key] === "string") return pkg.exports[key];
  const patterns = Object.keys(pkg.exports)
    .filter((k) => k.includes("*"))
    .sort((a, b) => b.indexOf("*") - a.indexOf("*") || b.length - a.length);
  for (const pattern of patterns) {
    const [prefix, suffix] = pattern.split("*");
    if (
      key.startsWith(prefix) &&
      key.endsWith(suffix) &&
      key.length >= pattern.length - 1
    ) {
      const match = key.slice(prefix.length, key.length - suffix.length);
      return pkg.exports[pattern].replace("*", match);
    }
  }
  return null;
};

const isExternal = (ref) =>
  /^(?:[a-z]+:|\/\/|#|data:|mailto:)/i.test(ref) || ref.startsWith("@");

const problems = [];
const report = (file, ref, why) =>
  problems.push(`${relative(ROOT, file)}: ${ref} -- ${why}`);

const files = await walk(ROOT);

// 1. Code/HTML references.
const CODE_REF =
  /(?:\bimport\s*(?:[^"'`;]*?\bfrom\s*)?|\bimport\(\s*|\bexport\s[^"'`;]*?\bfrom\s*|\b(?:src|href)\s*=\s*)["']([^"'`${}]+)["']/g;
for (const file of files.filter((f) => /\.(mjs|html?)$/.test(f))) {
  if (!/\/(src|demo|examples)\//.test(file)) continue;
  const text = await readFile(file, "utf8");
  for (const [, ref] of text.matchAll(CODE_REF)) {
    if (isExternal(ref) || !/^\.{1,2}\//.test(ref)) continue;
    const target = resolve(dirname(file), ref.split(/[?#]/)[0]);
    // A <define-component src="./x.mjs"> / <polyfill-window src="..."> is
    // resolved against the *page*, which for a demo is the file's own dir.
    const directoryIndex = ref.endsWith("/") && (await exists(join(target, "index.html")));
    if (!(await exists(target)) && !directoryIndex) report(file, ref, "no such file");
  }
}

// 2. Markdown links.
const MD_LINK = /\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
for (const file of files.filter((f) => f.endsWith(".md"))) {
  const text = await readFile(file, "utf8");
  for (const [, ref] of text.matchAll(MD_LINK)) {
    if (isExternal(ref)) continue;
    const target = resolve(dirname(file), ref.split("#")[0]);
    if (!(await exists(target)) && !(await isDir(target))) {
      report(file, ref, "no such file");
    }
  }
}

// 3. Package subpaths, wherever they're mentioned.
const SUBPATH = /@johnhenry\/canvas-fx\/([A-Za-z0-9._\/-]*[A-Za-z0-9_-])/g;
for (const file of files.filter((f) => /\.(md|mjs|html?)$/.test(f))) {
  if (file.endsWith("CHANGELOG.md")) continue; // history, not instructions
  const text = await readFile(file, "utf8");
  for (const [, subpath] of text.matchAll(SUBPATH)) {
    if (subpath.includes("<") || subpath.includes("...")) continue;
    const target = resolveExport(subpath);
    if (!target) report(file, subpath, "not matched by package.json exports");
    else if (!(await exists(join(ROOT, target)))) {
      report(file, `@johnhenry/canvas-fx/${subpath}`, `resolves to missing ${target}`);
    }
  }
}

// 4. Element README structure: every README with a generated API block
// (i.e. every custom element) reads Usage first, then its guide sections,
// then the API, and ends with Notes when it has them.
for (const file of files.filter((f) => f.endsWith("readme.md") && /\/src\//.test(f))) {
  const text = await readFile(file, "utf8");
  if (!text.includes("<!-- api:start")) continue;
  const headings = [...text.matchAll(/^## (.+)$/gm)].map((m) => m[1].trim());
  if (headings[0] !== "Usage") report(file, "## Usage", "must be the first section");
  if (!headings.includes("API")) report(file, "## API", "missing");
  const notes = headings.indexOf("Notes");
  if (notes >= 0 && notes !== headings.length - 1) report(file, "## Notes", "must be the last section");
  if (notes >= 0 && notes < headings.indexOf("API")) report(file, "## Notes", "must come after ## API");
}

if (problems.length) {
  console.error(problems.map((p) => `✖ ${p}`).join("\n"));
  console.error(`${problems.length} broken reference(s)`);
  process.exit(1);
}
console.log("✅ every relative import, markdown link, and package subpath resolves; element READMEs are well-formed");
