import test from "node:test";
import assert from "node:assert/strict";
import { loadSource } from "./load-source.mjs";
const { parseCardJson } = loadSource("app/import-json.ts");
test("QuickCards term/definition export becomes Vocab cards", () => {
  const cards = parseCardJson({ title:"Example", cards:[{term:" apple ",definition:" 蘋果 ",termMedia:{tts:"https://example.test"}}] });
  assert.equal(cards.length,1); assert.equal(cards[0].word,"apple"); assert.equal(cards[0].definition,"蘋果"); assert.equal("termMedia" in cards[0],false);
});
test("Vocab fields survive and malformed entries are ignored", () => {
  assert.equal(parseCardJson([{word:"apple",definition:"蘋果",exampleSentence:"An apple.",exampleTranslation:"一顆蘋果。"},null,5,{word:5,definition:"bad"}])[0].exampleTranslation,"一顆蘋果。");
  assert.deepEqual(parseCardJson({cards:"bad"}),[]); assert.deepEqual(parseCardJson(null),[]);
  assert.equal(parseCardJson([{word:"apple",definition:"蘋果"},null,{}]).length,1);
});
