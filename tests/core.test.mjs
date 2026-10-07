import test from "node:test";
import assert from "node:assert/strict";
import { loadSource } from "./load-source.mjs";
const { emptyState, normalizeBackup, createAndroidBackup, parseStoredState } = loadSource("app/storage.ts");
const { scheduleReview, recordCardReview, undoCardReview, localDateKey, streakStats } = loadSource("app/learning.ts");
const { mergeCardCompletion } = loadSource("app/card-completion.ts");
const { cardSpeechParts } = loadSource("app/card-speech.ts");
const { requestAi, requestAiCredential, AI_PROVIDERS, aiRetryDelay } = loadSource("app/ai-client.ts");
const { commitCardEdits } = loadSource("app/card-editing.ts");
const { parseGoogleLookup, parseCambridgeLookup, lookupDictionary } = loadSource("app/dictionary-lookup.ts");
const {detectBrowserPlatform}=loadSource("app/browser-platform.ts");

test("mobile installation routing distinguishes Safari, third-party browsers and iPad desktop UA",()=>{
  const safari="Mozilla/5.0 (iPhone; CPU iPhone OS 26_0) AppleWebKit/605.1.15 Version/26.0 Mobile Safari/604.1";
  assert.equal(detectBrowserPlatform(safari,"iPhone",5),"ios-safari");assert.equal(detectBrowserPlatform(safari.replace("Version/26.0","CriOS/140"),"iPhone",5),"ios-other");
  assert.equal(detectBrowserPlatform("Mozilla/5.0 Macintosh Version/26.0 Safari/605.1.15","MacIntel",5),"ios-safari");assert.equal(detectBrowserPlatform("Android Chrome","Linux",5),"android");assert.equal(detectBrowserPlatform("Macintosh Chrome","MacIntel",0),"desktop");
});
test("503 backoff is bounded, Retry-After respected, auth failures not retried and abort cancels waiting",async()=>{
  const original=globalThis.fetch;let calls=0;
  try{
    globalThis.fetch=async()=>{calls++;return calls<3 ? new Response("busy",{status:503,headers:{"retry-after":"0"}}) : Response.json({candidates:[{content:{parts:[{text:'{"ok":true}'}]}}]});};
    assert.equal(await requestAiCredential("gemini","fake","fake-model","https://example.test","test"),'{"ok":true}');assert.equal(calls,3);
    calls=0;globalThis.fetch=async()=>{calls++;return new Response("busy",{status:503,headers:{"retry-after":"0"}});};
    await assert.rejects(()=>requestAiCredential("gemini","fake","fake-model","https://example.test","test"),/已自動重試仍失敗/);assert.equal(calls,3);
    calls=0;globalThis.fetch=async()=>{calls++;return new Response("unauthorized",{status:401});};await assert.rejects(()=>requestAiCredential("gemini","fake","fake-model","https://example.test","test"),/金鑰/);assert.equal(calls,1);
    globalThis.fetch=async()=>new Response("busy",{status:503,headers:{"retry-after":"10"}});const controller=new AbortController();const request=requestAiCredential("gemini","fake","fake-model","https://example.test","test",[],undefined,controller.signal);setTimeout(()=>controller.abort(),10);await assert.rejects(()=>request,{name:"AbortError"});
    assert.equal(aiRetryDelay(new Response("",{headers:{"retry-after":"120"}}),0),120000);
  }finally{globalThis.fetch=original;}
});

test("multi-card editing is atomic and preserves study metadata while allowing rename swaps and insertion", () => {
  const first={...emptyState.cards[0],id:"one",deckId:"d",word:"one",definition:"一",order:0,phonetic:"",partOfSpeech:"",exampleSentence:"",exampleTranslation:"",notes:"筆記",favorite:true,intervalDays:25,nextReviewAt:5000,easeFactor:2.6};
  const second={...first,id:"two",word:"two",definition:"二",order:1,favorite:false};
  const state={...emptyState,decks:[{id:"d"}],cards:[first,second]};
  const rows=[{...first,cardId:"one",rowId:"one",word:"two",definition:"第二"},{...second,cardId:"two",rowId:"two",word:"one",definition:"第一"},{...second,cardId:undefined,rowId:"new",word:"three",definition:"第三"}];
  const next=commitCardEdits(state,"d",rows,["one","two"]);
  assert.equal(next.cards[0].id,"one");assert.equal(next.cards[0].intervalDays,25);assert.equal(next.cards[0].nextReviewAt,5000);assert.equal(next.cards[0].favorite,true);assert.equal(next.cards[0].notes,"筆記");
  assert.deepEqual(next.cards.map(card=>card.word),["two","one","three"]);assert.equal(next.cards[2].id,"new");
  assert.throws(()=>commitCardEdits(state,"d",[{...rows[0],definition:""},rows[1]],["one","two"]),/缺少/);
  assert.equal(state.cards[0].definition,"一");assert.throws(()=>commitCardEdits(state,"d",[rows[0],{...rows[1],word:"two"}],["one","two"]),/重複/);
});

test("Google dj=1 and array responses plus Chinese reverse translation match the reference project", () => {
  const entry=parseGoogleLookup("hello",{sentences:[{trans:"你好",orig:"hello"}],dict:[{pos:"noun",terms:["問候","招呼"]}]});
  assert.equal(entry.definition,"問候；招呼");assert.equal(entry.partOfSpeech,"n.");assert.equal(entry.source,"Google 翻譯");
  assert.equal(parseGoogleLookup("堅持",{sentences:[{trans:"persist",orig:"堅持"}]}).word,"persist");
  assert.equal(parseGoogleLookup("persist",[[["堅持","persist"]],[["verb",["堅持"]]]]).definition,"堅持");
});

test("Cambridge parser keeps nested text, IPA and definition/example translations separate; challenge pages fail", () => {
  const html=`<div class="entry-body__el"><span class="hw dhw">persist</span><span class="pos dpos">verb</span><span class="ipa dipa">pə<span>ˈ</span>sɪst</span><div class="def-block"><div class="def ddef_d">to <b>continue</b></div><span class="trans dtrans">堅持；持續</span><div class="examp dexamp"><span class="eg deg">We <b>persist</b> &amp; learn.</span><span class="trans dtrans">我們堅持並學習。</span></div></div></div><div class="entry-body__el"><span class="hw">unrelated</span><span class="dtrans">其他字</span></div>`;
  const entry=parseCambridgeLookup("persist",html);
  assert.equal(entry.word,"persist");assert.equal(entry.definition,"堅持；持續");assert.equal(entry.phonetic,"/pəˈsɪst/");assert.equal(entry.exampleSentence,"We persist & learn.");assert.equal(entry.exampleTranslation,"我們堅持並學習。");
  assert.throws(()=>parseCambridgeLookup("persist","<html>Please verify you are human</html>"),/條目/);
});

test("Google uses dj=1, caches success, and cools down 429 before reference-project fallback; explicit Cambridge never impersonates another source", async () => {
  const originalFetch=globalThis.fetch,requests=[];
  globalThis.fetch=async url=>{const address=new URL(url);requests.push(address);if(address.hostname.includes("cambridge"))return new Response("Forbidden",{status:403});if(address.hostname==="clients5.google.com")return Response.json(["備援翻譯"]);if(address.searchParams.get("q")==="cacheword")return Response.json({sentences:[{trans:"快取譯文",orig:"cacheword"}]});return new Response("Too many requests",{status:429});};
  try {
    assert.equal((await lookupDictionary("cacheword","GOOGLE")).definition,"快取譯文");await lookupDictionary("cacheword","GOOGLE");assert.equal(requests.length,1);assert.equal(requests[0].searchParams.get("dj"),"1");
    assert.equal((await lookupDictionary("fallbackword","GOOGLE")).definition,"備援翻譯");const count=requests.length;await lookupDictionary("anotherword","GOOGLE");assert.equal(requests.length,count+1);assert.equal(requests.at(-1).hostname,"clients5.google.com");assert.equal(requests.at(-1).searchParams.get("client"),"dict-chrome-ex");
    await assert.rejects(lookupDictionary("persist","CAMBRIDGE"),/HTTP 403/);assert.equal((await lookupDictionary("persist","AUTO")).source,"Google 翻譯");
    await assert.rejects(lookupDictionary("https://localhost/admin","GOOGLE"),/請輸入/);
  } finally {globalThis.fetch=originalFetch;}
});

test("manual AI completion preserves original fields and never attaches an unrelated sentence translation", () => {
  const original = { word: "persist", definition: "持續", exampleSentence: "We persist in learning.", exampleTranslation: "" };
  assert.equal(mergeCardCompletion(original, { word: "persist", exampleSentence: "We persist in learning.", exampleTranslation: "我們持續學習。" }).exampleTranslation, "我們持續學習。");
  assert.equal(mergeCardCompletion(original, { word: "persist", exampleSentence: "He persisted.", exampleTranslation: "他堅持了。" }).exampleTranslation, "");
  assert.deepEqual(mergeCardCompletion(original, { word: "other", definition: "錯誤" }), original);
  assert.equal(mergeCardCompletion(original, { word: "persist", definition: "被修改" }).definition, "持續");
});

test("front/back speech selections, repetitions and language match saved Android controls", () => {
  const card = { word: "persist", definition: "持續", phonetic: "/pəˈsɪst/", partOfSpeech: "v.", exampleSentence: "We persist.", exampleTranslation: "我們堅持。" };
  assert.deepEqual(cardSpeechParts(card, { ...emptyState.settings, ttsFrontSpellWord: true, ttsFrontRepetitions: 2 }, false).map(part => part.text), ["persist", "p. e. r. s. i. s. t", "persist", "p. e. r. s. i. s. t"]);
  const parts = cardSpeechParts(card, { ...emptyState.settings, ttsReadWord: false, ttsReadPhonetic: false, ttsReadPartOfSpeech: false, ttsReadExample: false, ttsGroupRepetitions: 1 }, true);
  assert.deepEqual(parts, [{ text: "持續", language: "zh-TW" }, { text: "我們堅持。", language: "zh-TW" }]);
});

test("all four AI provider request formats are tested without using real keys or calling a provider", async () => {
  const originalFetch = globalThis.fetch; const requests = [];
  globalThis.fetch = async (url, options) => { requests.push({ url, ...options }); return Response.json({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }], content: [{ type: "text", text: '{"ok":true}' }], choices: [{ message: { content: '{"ok":true}' } }] }); };
  try {
    for (const provider of Object.keys(AI_PROVIDERS)) assert.equal(await requestAiCredential(provider, "fixture-key", "fixture-model", AI_PROVIDERS[provider].base, "Only JSON", [], { mime: "image/png", base64: "fixture" }), '{"ok":true}');
    assert.equal(requests[0].headers["x-goog-api-key"], "fixture-key"); assert.ok(!requests[0].url.includes("fixture-key"));
    assert.equal(requests[1].headers.Authorization, "Bearer fixture-key");
    assert.equal(JSON.parse(requests[2].body).max_completion_tokens, 8192);
    assert.equal(requests[3].headers["anthropic-dangerous-direct-browser-access"], "true"); assert.equal(JSON.parse(requests[3].body).messages[0].content[1].type, "image");
  } finally { globalThis.fetch = originalFetch; }
});

test("AI honors disabled/gateway preferences and only fails over to saved credentials", async () => {
  await assert.rejects(requestAi({ ...emptyState.settings, aiEnabled: false }, "JSON"), /關閉/);
  await assert.rejects(requestAi({ ...emptyState.settings, usePersonalAiApi: false }, "JSON"), /尚未部署/);
  const originalFetch = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; return calls === 1 ? new Response("", { status: 401 }) : Response.json({ choices: [{ message: { content: '{"ok":true}' } }] }); };
  try {
    assert.equal(await requestAi({ ...emptyState.settings, aiProfiles: [{ id: "a", provider: "gemini", model: "fixture-model", key: "first" }, { id: "b", provider: "openai", model: "fixture-model", key: "second" }] }, "Only JSON"), '{"ok":true}');
    assert.equal(calls, 2);
  } finally { globalThis.fetch = originalFetch; }
});

const android = {
  format: "vocab-backup", version: 8,
  decks: [{ id: 12, name: "第一課", category: "高中英文", colorHex: "#245FE5", createdAt: 100, sortOrder: 150 }],
  cards: [{ id: 39, deckId: 12, word: "persist", definition: "持續", sortOrder: 1234, createdAt: 500,
    intervalDays: 10, easeFactor: 2.5, repetitionCount: 3, nextReviewTimestamp: 15000, lastReviewedTimestamp: 12000,
    isFavorite: true, isSuspended: false, mistakeCount: 2 }],
  studyLogs: [{ cardId: 39, rating: 3, reviewedAt: 12000 }],
  grammarLibraries: [{ course: "高中英文", name: "時態", sortOrder: 100 }],
  grammarNotes: [{ id: 7, course: "高中英文", folder: "時態", title: "現在完成式", masteryPercent: 50 }],
  grammarPatterns: [{ id: 9, grammarNoteId: 7, formula: "have + p.p." }],
  grammarExamples: [{ id: 11, grammarNoteId: 7, grammarPatternId: 9, sentence: "I have studied." }],
  grammarQuestions: [{ id: 8, grammarNoteId: 7, grammarPatternId: 9, answer: "have" }],
  grammarWeaknesses: [{ id: 13, grammarNoteId: 7, ruleKey: "tense" }],
  grammarWritingRecords: [{ id: 10, originalText: "I has studied.", revisedText: "I have studied.", issuesJson: "[]" }],
  makeUpCheckIns: ["2026-10-05"],
};

test("Android v8 round trip preserves content, relationships, ordering and SRS", () => {
  const state = normalizeBackup(android);
  assert.equal(state.cards[0].order, 1234);
  assert.equal(state.cards[0].intervalDays, 10);
  const restored = normalizeBackup(JSON.parse(JSON.stringify(state)));
  const exported = createAndroidBackup(restored, 999);
  for (const key of ["grammarLibraries", "grammarNotes", "grammarPatterns", "grammarExamples", "grammarQuestions", "grammarWeaknesses", "grammarWritingRecords", "makeUpCheckIns"]) assert.deepEqual(exported[key], android[key]);
  assert.deepEqual(exported.studyLogs, android.studyLogs);
  assert.equal(exported.cards[0].sortOrder, 1234);
  assert.equal(exported.cards[0].easeFactor, 2.5);
  assert.equal(exported.cards[0].repetitionCount, 3);
  assert.equal(exported.cards[0].createdAt, 500);
  assert.equal(exported.decks[0].category, "高中英文");
});

test("UUIDs get collision-free Android IDs; API keys are never exported", () => {
  const state = normalizeBackup(android);
  state.decks.push({ ...state.decks[0], id: "web-deck", name: "第二課" });
  state.cards.push({ ...state.cards[0], id: "web-card", deckId: "web-deck" });
  state.settings.aiApiKey = "private-test-key";
  const output = createAndroidBackup(state);
  assert.equal(new Set(output.decks.map(item => item.id)).size, 2);
  assert.equal(new Set(output.cards.map(item => item.id)).size, 2);
  assert.equal(output.cards[1].deckId, output.decks[1].id);
  assert.ok(!JSON.stringify(output).includes("private-test-key"));
});

test("unsupported backups and dangling cards fail without pretending to restore", () => {
  assert.throws(() => normalizeBackup({ ...android, version: 9 }), /版本不支援/);
  assert.throws(() => normalizeBackup({ ...android, cards: [{ ...android.cards[0], deckId: 99 }] }), /無效/);
  assert.throws(() => parseStoredState({ version: 1, decks: [], cards: [null] }));
  assert.throws(() => parseStoredState({ version: 22 }));
  assert.equal(parseStoredState(emptyState).settings.onboardingDone, false);
});

test("SM-2 ratings follow Android schedules, bounds and 10-minute relearning", () => {
  const fresh = { ...normalizeBackup(android).cards[0], intervalDays: 0, repetitionCount: 0, easeFactor: 2.5 };
  assert.equal(scheduleReview(fresh, 1, 1000).nextReviewAt, 601000);
  assert.equal(scheduleReview(fresh, 2, 1000).intervalDays, 1);
  assert.equal(scheduleReview(fresh, 3, 1000).intervalDays, 1);
  assert.equal(scheduleReview(fresh, 4, 1000).intervalDays, 3);
  let card = fresh;
  for (const expected of [1, 3, 7, 17, 42]) { card = scheduleReview(card, 3, 1000); assert.equal(card.intervalDays, expected); }
  assert.equal(card.mastered, true);
  card = scheduleReview(card, 1, 1000);
  assert.equal(card.mastered, false); assert.equal(card.repetitionCount, 0);
  assert.equal(scheduleReview({ ...fresh, intervalDays: 3650, repetitionCount: 12, easeFactor: 3 }, 4).intervalDays, 3650);
  assert.throws(() => scheduleReview(fresh, 0));
});

test("undo restores the entire card and the review date even across midnight", () => {
  const state = normalizeBackup(android);
  const original = { ...state.cards[0] };
  const at = new Date(2026, 9, 5, 23, 59).getTime();
  const reviewed = recordCardReview(state, original.id, 1, at);
  assert.equal(reviewed.logs.find(log => log.date === "2026-10-05").count, 1);
  const undone = undoCardReview(reviewed, original);
  assert.deepEqual(undone.cards[0], original);
  assert.deepEqual(undone.reviewLogs, state.reviewLogs);
  assert.equal(undone.logs.find(log => log.date === "2026-10-05").count, 0);
});

test("streak includes yesterday and make-up check-ins using local calendar days", () => {
  const today = new Date(2026, 9, 6, 0, 30);
  assert.equal(localDateKey(today), "2026-10-06");
  const state = { ...emptyState, logs: [{ date: "2026-10-04", count: 1 }], androidArchive: { version: 8, makeUpCheckIns: ["2026-10-05"] } };
  assert.deepEqual(streakStats(state, today), { current: 2, longest: 2 });
  assert.deepEqual(streakStats(state, new Date(2026, 9, 7)), { current: 0, longest: 2 });
});

test("speech waits for completion and settles cancellation even without Safari events", async () => {
  let utterance;
  globalThis.window = { speechSynthesis: { cancel() {}, getVoices: () => [], speak(value) { utterance = value; } } };
  globalThis.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
  const { speakText, cancelSpeech } = loadSource("app/speech.ts");
  let complete = false;
  const spoken = speakText("A longer example sentence.");
  spoken.then(() => { complete = true; });
  await Promise.resolve();
  assert.equal(complete, false);
  utterance.onend();
  assert.equal(await spoken, true);
  const cancelled = speakText("Another example.");
  cancelSpeech();
  assert.equal(await cancelled, false);
  delete globalThis.window; delete globalThis.SpeechSynthesisUtterance;
});
