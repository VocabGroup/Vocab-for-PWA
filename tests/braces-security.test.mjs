import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const braces=require("braces");

test("braces rejects excessive brace, parenthesis and mixed nesting before recursion",()=>{
  for(const input of ["{".repeat(2000)+"a,b"+"}".repeat(2000),"(".repeat(2000)+"x"+")".repeat(2000),"{(".repeat(500)+"a,b"+")}".repeat(500),"{".repeat(1000)+"1..2,x"]) {
    for(const method of [braces,braces.create,braces.parse,braces.stringify,braces.compile,braces.expand,require("braces/lib/parse")]) {
      assert.throws(()=>method(input),error=>error instanceof RangeError && /braces safety limit/.test(error.message));
    }
  }
});

test("all recursive APIs also reject externally supplied deep/cyclic ASTs",()=>{
  let deep={type:"text",value:"x"};
  for(let i=0;i<10000;i++)deep={type:"root",nodes:[deep]};
  const cyclic={type:"root",nodes:[]};cyclic.nodes.push(cyclic);
  const wide={type:"root",nodes:Array.from({length:65537},()=>({type:"text",value:"x"}))};
  for(const method of [braces.stringify,braces.compile,braces.expand,require("braces/lib/stringify"),require("braces/lib/compile"),require("braces/lib/expand")]) {
    for(const ast of [deep,cyclic,wide])assert.throws(()=>method(ast),/braces safety limit/);
  }
});

test("expansion rejects cyclic parent chains on supplied ASTs",()=>{
  const parent={type:"paren",queue:[]};parent.parent=parent;
  const ast={type:"paren",nodes:[],parent};
  assert.throws(()=>braces.expand(ast),/braces safety limit: parent chain/);
});

test("ordinary globs retain upstream compile, expand and quote behavior",()=>{
  assert.deepEqual(braces("src/{app,lib}/**/*.{ts,tsx}",{expand:true}),["src/app/**/*.ts","src/app/**/*.tsx","src/lib/**/*.ts","src/lib/**/*.tsx"]);
  assert.equal(braces.compile("file{01..03}.ts"),"file(0[1-3]).ts");
  assert.deepEqual(braces.expand("{a,{b,c}}"),["a","b","c"]);
  assert.deepEqual(braces.expand("{1..3}"),["1","2","3"]);
  assert.equal(braces.stringify(braces.parse("src/{a,b}/x")),"src/{a,b}/x");
  assert.equal(braces.compile('"'+"{".repeat(1000)+'"'),"{".repeat(1000));
  assert.equal(braces.compile("["+"{".repeat(1000)+"]"),"["+"{".repeat(1000)+"]");
  assert.equal(braces.compile("\\{".repeat(1000)),"{".repeat(1000));
  assert.doesNotThrow(()=>braces.compile("{".repeat(30)+"a,b"+"}".repeat(30)));
  const micromatch=require("micromatch");
  assert.deepEqual(micromatch(["src/a.ts","src/b.tsx","src/c.js"],["src/*.{ts,tsx}"]),["src/a.ts","src/b.tsx"]);
});
