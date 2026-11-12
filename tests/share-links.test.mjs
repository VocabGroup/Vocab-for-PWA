import test from "node:test";
import assert from "node:assert/strict";
import {loadSource} from "./load-source.mjs";
const {shareRequest}=loadSource("worker/shares.ts");
const origin="https://vocab-adam.pages.dev";
const payload={format:"vocab-folder-share",version:1,apiKey:"PRIVATE-KEY",decks:[{name:"教材",course:"課程",cards:[{word:"apple",definition:"蘋果",mastered:true,id:"PRIVATE-ID"}]}]};
function setup(){const entries=new Map(),writes=[];return {entries,writes,env:{SHARE_RATE_SALT:"test-only-non-production-salt-32-characters",VOCAB_SHARES:{get:async k=>entries.get(k)??null,put:async(k,v,o)=>{entries.set(k,v);writes.push({k,v,o});},delete:async k=>entries.delete(k)}}};}
function create(body=payload,headers={}){return new Request(origin+"/api/shares",{method:"POST",headers:{"Content-Type":"application/json","CF-Connecting-IP":"192.0.2.1",...headers},body:JSON.stringify(body)});}
test("share has random capability URL, 7-day TTL, sanitized content and no read-time renewal",async()=>{
 const {env,writes}=setup();const before=Date.now();const result=await shareRequest(create(),env);assert.equal(result.status,201);const p=await result.json();assert.match(p.id,/^[a-f0-9]{48}$/);assert.equal(p.url,origin+"/share#"+p.id);assert.ok(p.expiresAt>=before+7*86400*1000);const stored=writes.find(w=>w.k.startsWith("share:"));assert.equal(stored.o.expirationTtl,604800);assert.ok(!stored.v.includes("PRIVATE"));assert.ok(!stored.v.includes("mastered"));assert.ok(writes.every(w=>!w.k.includes("192.0.2.1")));
 const count=writes.length;const read=await shareRequest(new Request(origin+"/api/shares/"+p.id),env);assert.equal(read.status,200);assert.equal(writes.length,count);assert.equal(read.headers.get("cache-control"),"no-store");const json=await read.json();assert.ok(!JSON.stringify(json).includes("deleteHash"));assert.ok(!JSON.stringify(json).includes(p.deleteToken));
});
test("expired links rejected even if KV still holds data; revoke needs separate credential",async()=>{
 const {env,entries}=setup();const p=await (await shareRequest(create(),env)).json();const url=origin+"/api/shares/"+p.id;assert.equal((await shareRequest(new Request(url,{method:"DELETE"}),env)).status,403);
 assert.equal((await shareRequest(new Request(url,{method:"DELETE",headers:{Authorization:"Bearer "+p.deleteToken}}),env)).status,200);assert.equal((await shareRequest(new Request(url),env)).status,404);
 entries.set("share:"+p.id,JSON.stringify({expiresAt:Date.now()-1,share:payload}));assert.equal((await shareRequest(new Request(url),env)).status,410);
});
test("fail closed on missing bindings, invalid origin, oversized input, invalid schema and quota",async()=>{
 const {env}=setup();assert.equal((await shareRequest(create(),{})).status,503);assert.equal((await shareRequest(create(payload,{Origin:"https://evil.invalid"}),env)).status,403);
 assert.equal((await shareRequest(create({bad:true}),env)).status,400);
 assert.equal((await shareRequest(create({...payload,padding:"x".repeat(600000)}),env)).status,400);
 for(let i=0;i<5;i++)assert.equal((await shareRequest(create(),env)).status,201);assert.equal((await shareRequest(create(),env)).status,429);
});
