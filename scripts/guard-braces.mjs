// Local mitigation for GHSA-vfj7-8cjw-p6xm. Keep the upstream version and audit
// warning visible. Fail closed if an upstream update changes the reviewed files.
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const directory = dirname(require.resolve("braces/package.json"));
const metadata = JSON.parse(await readFile(join(directory, "package.json"), "utf8"));
if (metadata.version !== "3.0.3") throw new Error("Review the braces mitigation before changing its pinned version");
const hash = text => createHash("sha256").update(text).digest("hex");
const guardSource = await readFile(fileURLToPath(new URL("./braces-guard.cjs", import.meta.url)), "utf8");
const entries = [
  ["parse.js", "e572166565f15fa6ad9865ae49d678218e32aabfd1b3720f6d0d43d39800d310", source => source
    .replace("  const push = node => {", "  const push = node => {\n    if (node.nodes && stack.length >= 64) throw new RangeError('braces safety limit: nesting exceeds 64');")],
  ["stringify.js", "379f22d77bfa1478341ccd49c5e4267464aabcbba03558bab332aac23fc6f23a", source => source
    .replace("module.exports = (ast, options = {}) => {", "module.exports = (ast, options = {}) => {\n  require('./vocab-guard')(ast);")],
  ["compile.js", "dc98f22eee3d511785d92a00758d5f0d48efed5f5813bdecc2de430c529b5c9f", source => source
    .replace("const compile = (ast, options = {}) => {", "const compile = (ast, options = {}) => {\n  require('./vocab-guard')(ast);")],
  ["expand.js", "41ccc196ebfa7b7781a634e721eb744e4e7bcb54cba427a7e3d6806a1b9e58f7", source => source
    .replace("const expand = (ast, options = {}) => {", "const expand = (ast, options = {}) => {\n  require('./vocab-guard')(ast);")
    .replace("    while (p.type", "    let parentSteps = 0;\n    while (p.type")
    .replace("      p = p.parent;", "      if (++parentSteps > 64) throw new RangeError('braces safety limit: parent chain');\n      p = p.parent;")
    .replace("    while (block.type", "    let blockSteps = 0;\n    while (block.type")
    .replace("      block = block.parent;", "      if (++blockSteps > 64) throw new RangeError('braces safety limit: parent chain');\n      block = block.parent;")],
];
// Validate every file before touching any; repeated runs accept only our exact patch.
const updates = [];
for (const [name, expectedHash, patch] of entries) {
  const path = join(directory, "lib", name);
  const source = await readFile(path, "utf8");
  let original = source;
  const marker = "// Vocab bounded-braces mitigation\n";
  if (source.startsWith(marker)) {
    // The original is kept locally so the patch remains verifiable and reversible.
    original = await readFile(`${path}.vocab-original`, "utf8");
  }
  if (hash(original) !== expectedHash) throw new Error(`Unexpected braces source: ${name}; refusing an unreviewed patch`);
  const patched = marker + patch(original);
  if (source !== original && source !== patched) throw new Error(`Unexpected modifications to braces/${name}`);
  updates.push({ path, original, patched });
}
await writeFile(join(directory, "lib", "vocab-guard.js"), guardSource);
for (const { path, original, patched } of updates) {
  await writeFile(`${path}.vocab-original`, original);
  await writeFile(path, patched);
}
console.log("Applied verified braces 3.0.3 depth/AST guards (upstream audit warning retained)");
