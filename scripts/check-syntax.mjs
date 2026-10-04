// No DOM test environment exists yet (see AGENTS.md's Non-goals) -- this
// is the one automated gate this package has: every .mjs/.js file under
// src/ must at least parse. Real behavioral coverage is manual, via each
// module's own demo.html/demo.htm (see AGENTS.md's verification loop).
import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = new URL("../src", import.meta.url).pathname;

const walk = async (dir) => {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(p)));
    } else if (/\.(mjs|js)$/.test(entry.name)) {
      files.push(p);
    }
  }
  return files;
};

const files = await walk(ROOT);
let failed = 0;
for (const file of files) {
  try {
    execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
  } catch (err) {
    failed++;
    console.error(`✖ ${file}`);
    console.error(err.stderr.toString());
  }
}

console.log(
  failed
    ? `${failed}/${files.length} files failed to parse`
    : `✅ ${files.length} files parse cleanly`
);
process.exit(failed ? 1 : 0);
