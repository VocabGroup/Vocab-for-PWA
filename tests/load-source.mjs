import ts from "typescript";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
const nativeRequire = createRequire(import.meta.url);
const modules = new Map();
export function loadSource(path) {
  const file = resolve(path);
  if (modules.has(file)) return modules.get(file).exports;
  const compiledModule = { exports: {} };
  modules.set(file, compiledModule);
  const result = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const require = name => name.startsWith(".") ? loadSource(resolve(dirname(file), `${name}.ts`)) : nativeRequire(name);
  new Function("require", "module", "exports", result.outputText)(require, compiledModule, compiledModule.exports);
  return compiledModule.exports;
}
