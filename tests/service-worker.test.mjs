import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
function worker() {
  const handlers = new Map();
  const context = { self: { location: { origin: "https://vocab.example" }, addEventListener: (type, handler) => handlers.set(type, handler) }, URL };
  vm.runInNewContext(source, context);
  return handlers;
}
test("service worker never intercepts AI, API, auth, RSC or unknown resources", () => {
  const handler = worker().get("fetch");
  for (const [url, extra] of [
    ["https://api.example/model", {}], ["https://vocab.example/api/import", {}],
    ["https://vocab.example/api/data.js", {}], ["https://vocab.example/missing.json", {}],
    ["https://vocab.example/sw.js", {}], ["https://vocab.example/app.js?token=secret", {}],
    ["https://vocab.example/app.js", { headers: new Headers({ Authorization: "private" }) }],
    ["https://vocab.example/", { headers: new Headers({ RSC: "1" }) }],
  ]) {
    let intercepted = false;
    handler({ request: { method: "GET", mode: "cors", headers: new Headers(), url, ...extra }, respondWith: () => { intercepted = true; } });
    assert.equal(intercepted, false, url);
  }
});

test("activation keeps caches belonging to other apps", async () => {
  const handlers = new Map(), removed = [];
  vm.runInNewContext(source, { URL,
    self: { location: { origin: "https://vocab.example" }, addEventListener: (type, handler) => handlers.set(type, handler), clients: { claim: async () => undefined } },
    caches: { keys: async () => ["other-app-data", "vocab-shell-v1", "vocab-pwa-old", "vocab-pwa-development"], delete: async key => removed.push(key) },
  });
  let work;
  handlers.get("activate")({ waitUntil: promise => { work = promise; } });
  await work;
  assert.deepEqual(removed.sort(), ["vocab-pwa-old", "vocab-shell-v1"]);
});
