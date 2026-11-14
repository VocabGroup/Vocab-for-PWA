import test from "node:test";
import assert from "node:assert/strict";
import {loadSource} from "./load-source.mjs";
const {shareId,androidShareIntent,receivingEnvironment,parseShareReceipts}=loadSource("app/share-receive.ts");
test("native handoff validates IDs and preserves a same-site fallback",()=>{
 const id="a".repeat(48);assert.equal(shareId("#"+id),id);
 assert.throws(()=>androidShareIntent("bad;package=evil","https://vocab-adam.pages.dev"));
 const intent=androidShareIntent(id,"https://vocab-adam.pages.dev");
 assert.match(intent,/package=com\.aistudio\.vocabpulse\.srsapp;/);
 assert.ok(intent.includes(encodeURIComponent("https://vocab-adam.pages.dev/share?app=unavailable#"+id)));
 assert.equal(receivingEnvironment("iPhone",false),"ios");
 assert.equal(receivingEnvironment("Android",false),"android");
 assert.equal(receivingEnvironment("Android Line/20",false),"embedded");
 assert.equal(receivingEnvironment("iPhone",true),"standalone");
});
test("damaged receipt storage cannot prevent sharing from opening",()=>{
 for(const raw of ["null","[]","false","broken",'{"__proto__":[]}'])assert.deepEqual(parseShareReceipts(raw),{});
 const id="a".repeat(48);assert.deepEqual(parseShareReceipts(JSON.stringify({[id]:["deck-1"]})),{[id]:["deck-1"]});
 assert.deepEqual(parseShareReceipts(JSON.stringify({[id]:[null]})),{});
});
