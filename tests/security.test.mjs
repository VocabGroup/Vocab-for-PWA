import test from "node:test";
import assert from "node:assert/strict";
import {loadSource} from "./load-source.mjs";
const {publicImportUrl,boundedText,fetchPublicImport,secureResponse}=loadSource("worker/security.ts");

test("public imports reject private destinations, userinfo, ports and lookalike domains",()=>{
  for(const url of ["http://quizlet.com/a","https://127.0.0.1/","https://quizlet.com.evil.test/","https://quizlet.com@evil.test/","https://user:pass@quizlet.com/a","https://quizlet.com:8443/a"])assert.throws(()=>publicImportUrl(url));
  assert.equal(publicImportUrl("https://www.quizlet.com/a").hostname,"www.quizlet.com");
});
test("bounded body reads cancel oversized streams",async()=>{
  assert.equal(await boundedText(new Response("abc"),3),"abc");
  await assert.rejects(()=>boundedText(new Response("abcd"),3),/大小限制/);
  await assert.rejects(()=>boundedText(new Response("a",{headers:{"content-length":"50"}}),3),/大小限制/);
});
test("redirect targets are validated before any second network call",async()=>{
  const original=globalThis.fetch;let calls=0;
  globalThis.fetch=async()=>{calls++;return new Response(null,{status:302,headers:{location:"https://169.254.169.254/metadata"}});};
  try{await assert.rejects(()=>fetchPublicImport(new URL("https://quizlet.com/a")),/允許網站/);assert.equal(calls,1);}finally{globalThis.fetch=original;}
});
test("responses prohibit framing, object embeds and unnecessary device permissions",()=>{
  const response=secureResponse(new Response("ok"));
  assert.equal(response.headers.get("x-frame-options"),"DENY");assert.equal(response.headers.get("x-content-type-options"),"nosniff");
  assert.match(response.headers.get("content-security-policy"),/object-src 'none'/);assert.match(response.headers.get("permissions-policy"),/geolocation=\(\)/);
});
