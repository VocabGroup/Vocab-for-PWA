import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadSource } from "./load-source.mjs";
const { ecdictKey, ecdictShard, lookupEcdict, ECDICT_DATA_VERSION } = loadSource("app/ecdict.ts");
const { lookupBrowserDictionary } = loadSource("app/browser-dictionary.ts");

test("automatic English lookup prefers same-origin ECDICT without calling translation services", async () => {
  const original = globalThis.fetch;
  const calls = [];
  try {
    globalThis.fetch = async url => {
      calls.push(url);
      assert.match(url, /^\/ecdict\/[a-f0-9]{2}\.json\?v=zh-TW-v1$/);
      return Response.json(JSON.parse(readFileSync(`public${new URL(url,"https://example.test").pathname}`, "utf8")));
    };
    assert.equal((await lookupBrowserDictionary("apple", "AUTO")).source, "ECDICT 英漢字典");
    assert.equal(calls.length, 1);
  } finally { globalThis.fetch = original; }
});

test("bundled ECDICT shard lookup, case normalization, honest missing fields", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async url => Response.json(JSON.parse(readFileSync(`public${new URL(url,"https://example.test").pathname}`, "utf8")));
    for (const word of ["apple", "abandon", "serendipity", "take off"]) {
      const entry = await lookupEcdict(` ${word.toUpperCase()} `);
      assert.equal(entry.word.toLowerCase(), word);
      assert.ok(entry.definition);
      assert.equal(entry.exampleSentence, "");
      assert.equal(entry.exampleTranslation, "");
      assert.equal(entry.sourceUrl, "https://github.com/skywind3000/ECDICT");
    }
    await assert.rejects(() => lookupEcdict("zzzznonexistentword"), /查無/);
    assert.throws(() => ecdictKey("蘋果"), /中文/);
    assert.throws(() => ecdictKey("../secret"));
    assert.throws(() => ecdictKey("a".repeat(81)));
    assert.match(ecdictShard("apple"), /^[0-9a-f]{2}$/);
  } finally { globalThis.fetch = original; }
});

test("Taiwan Traditional Chinese definitions are returned ready for display and saving", async () => {
  const manifest = JSON.parse(readFileSync("public/ecdict/manifest.json", "utf8"));
  assert.equal(manifest.translation, "zh-TW");
  assert.equal(manifest.dataVersion, ECDICT_DATA_VERSION);
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async url => Response.json(JSON.parse(readFileSync(`public${new URL(url,"https://example.test").pathname}`, "utf8")));
    for (const [word, traditional, simplified] of [["apple","蘋果","苹果"],["software","軟體","软件"],["computer","電腦","电脑"],["memory","記憶","记忆"]]) {
      const entry = await lookupEcdict(word);
      assert.ok(entry.definition.includes(traditional), `${word}: ${entry.definition}`);
      assert.ok(!entry.definition.includes(simplified));
    }
  } finally { globalThis.fetch = original; }
});
