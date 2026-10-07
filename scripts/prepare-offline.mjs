import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../dist/client");
async function discover(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(entry => entry.isDirectory() ? discover(join(directory, entry.name)) : [join(directory, entry.name)]));
  return nested.flat();
}
const files = (await discover(root)).filter(path => /\.(?:js|css|woff2?|ttf|otf)$/.test(path) && !path.endsWith("sw.js")).sort();
if (!files.length) throw new Error("Client build has no offline assets");
const digest = createHash("sha256");
for (const file of files) { digest.update(relative(root, file)); digest.update(await readFile(file)); }
const source = await readFile(join(root, "sw.js"), "utf8");
digest.update(source);
digest.update(await readFile(join(root, "manifest.webmanifest")));
const build = digest.digest("hex").slice(0, 16);
const urls = files.map(file => `/${relative(root, file).replaceAll("\\", "/")}`);
await writeFile(join(root, "offline-assets.json"), JSON.stringify({ build, urls }));
await writeFile(join(root, "sw.js"), source.replace('const BUILD_ID = "development";', `const BUILD_ID = "${build}";`));
console.log(`Offline build ${build}: ${urls.length} assets prepared`);
