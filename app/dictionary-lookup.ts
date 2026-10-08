import type { Card } from "./types";

export type LookupEntry = Pick<Card, "word" | "definition" | "phonetic" | "partOfSpeech" | "exampleSentence" | "exampleTranslation" | "notes"> & { source: string; sourceUrl: string };
export type LookupSource = "AUTO" | "GOOGLE" | "CAMBRIDGE" | "FREE";
const blank = { phonetic:"", partOfSpeech:"", exampleSentence:"", exampleTranslation:"", notes:"" };
const pos: Record<string,string> = { noun:"n.", verb:"v.", adjective:"adj.", adverb:"adv.", pronoun:"pron.", preposition:"prep.", conjunction:"conj.", interjection:"interj." };
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const array = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const entities: Record<string,string> = { amp:"&", lt:"<", gt:">", quot:'"', apos:"'", nbsp:" ", rsquo:"’", lsquo:"‘", ldquo:"“", rdquo:"”", ndash:"–", mdash:"—", hellip:"…" };
export function decodeDictionaryText(value: string): string {
  return value.replace(/&#(x[0-9a-f]+|\d+);|&([a-z]+);/gi, (match, number: string, name: string) => {
    if (name) return entities[name.toLowerCase()] ?? match;
    const code = number[0].toLowerCase() === "x" ? parseInt(number.slice(1),16) : Number(number);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
  }).replace(/\s+/g," ").trim();
}
export function parseGoogleLookup(query: string, data: unknown): LookupEntry {
  if (data && typeof data==="object" && !Array.isArray(data)) {
    const object=data as {sentences?:{trans?:string;orig?:string;src_translit?:string}[];dict?:{pos?:string;terms?:string[];entry?:{word?:string}[]}[]};
    data=[(object.sentences??[]).map(sentence=>[sentence.trans,sentence.orig]),(object.dict??[]).map(item=>[item.pos,item.terms??item.entry?.map(entry=>entry.word)??[]])];
  }
  const root = array(data), rows = array(root[0]);
  const translated = rows.map(row => text(array(row)[0])).join("").trim();
  if (!translated) throw new Error("Google 沒有回傳翻譯結果");
  const chinese = /[\u3400-\u9fff]/.test(query);
  const parts: string[] = [], definitions: string[] = [];
  for (const value of array(root[1])) { const row = array(value); const meanings = [...new Set(array(row[1]).map(text).filter(Boolean))].slice(0,6); if (meanings.length) { parts.push(pos[text(row[0])] ?? text(row[0])); definitions.push(meanings.join("；")); } }
  function example(value: unknown, depth = 0): string { if (depth > 20) return ""; if (typeof value === "string") return /<b>.*?<\/b>/i.test(value) ? decodeDictionaryText(value.replace(/<[^>]*>/g,"")) : ""; for (const child of array(value)) { const found = example(child,depth+1); if (found) return found; } return ""; }
  const pronunciation = text(array(rows[1])[3]);
  return { ...blank, word:chinese ? translated : text(array(rows[0])[1]) || query, definition:chinese ? query : definitions.join("／") || translated,
    phonetic:!chinese && pronunciation ? `/${pronunciation}/` : "", partOfSpeech:chinese ? "" : [...new Set(parts)].join("/"), exampleSentence:chinese ? "" : example(root),
    source:chinese ? "Google 中英翻譯" : "Google 翻譯", sourceUrl:`https://translate.google.com/?sl=${chinese ? "zh-TW" : "en"}&tl=${chinese ? "en" : "zh-TW"}&text=${encodeURIComponent(query)}&op=translate` };
}

type HtmlNode = { tag: string; classes: string[]; children: (HtmlNode|string)[]; parent?: HtmlNode };
export function parseCambridgeLookup(query: string, html: string): LookupEntry {
  // Parse public entry markup as inert text; never execute or return upstream HTML.
  const root: HtmlNode = { tag:"root", classes:[], children:[] }, stack = [root], nodes: HtmlNode[] = [];
  const cleaned = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,"");
  for (const token of cleaned.match(/<[^>]*>|[^<]+/g) ?? []) {
    if (token.startsWith("</")) { const tag = token.slice(2).match(/^\w+/)?.[0]?.toLowerCase(); const index = stack.findLastIndex(node => node.tag === tag); if (index > 0) stack.length = index; }
    else if (token.startsWith("<")) { const tag = token.slice(1).match(/^\w+/)?.[0]?.toLowerCase(); if (!tag) continue; const classes = token.match(/\bclass\s*=\s*(?:"([^"]*)"|'([^']*)')/i); const node: HtmlNode = { tag, classes:(classes?.[1] ?? classes?.[2] ?? "").split(/\s+/), children:[], parent:stack.at(-1) }; stack.at(-1)!.children.push(node); nodes.push(node); if (!/^(br|hr|img|input|meta|link|source|wbr|area|base|embed|param|track|col)$/.test(tag) && !token.endsWith("/>")) { if (stack.length < 100) stack.push(node); } }
    else stack.at(-1)!.children.push(token);
  }
  function content(node: HtmlNode): string { return node.children.map(child => typeof child === "string" ? child : content(child)).join(""); }
  const scope = nodes.find(node => node.classes.includes("entry-body__el")) ?? nodes.find(node => node.classes.includes("entry-body"));
  if (!scope) throw new Error("劍橋沒有回傳辭典條目，可能要求驗證或頁面格式已變更");
  const inside = (node: HtmlNode) => { for (let item: HtmlNode|undefined = node; item; item=item.parent) if (item===scope) return true; return false; };
  const inExample = (node: HtmlNode) => { for (let item: HtmlNode|undefined=node; item && item!==scope; item=item.parent) if (item.classes.includes("examp")) return true; return false; };
  const collect = (className: string, limit=6, definitionsOnly=false) => [...new Set(nodes.filter(node => inside(node) && node.classes.includes(className) && (!definitionsOnly || !inExample(node))).map(node => decodeDictionaryText(content(node))).filter(Boolean))].slice(0,limit);
  const translations=collect("dtrans",6,true), definitions=collect("def",5,true), example=collect("eg",1)[0] ?? "";
  const definition=(translations.length ? translations : definitions).join("；"); if (!definition) throw new Error("劍橋沒有可顯示的解釋");
  const ipa=(collect("dipa",1)[0] ?? collect("ipa",1)[0] ?? "").replace(/^\/+|\/+$/g,"");
  const exampleNode=nodes.find(node=>inside(node) && node.classes.includes("eg"));
  const exampleTranslation=exampleNode?.parent ? nodes.find(node=>node.parent===exampleNode.parent && (node.classes.includes("dtrans") || node.classes.includes("trans"))) : undefined;
  return { ...blank, word:collect("hw",1)[0] ?? query, definition, phonetic:ipa ? `/${ipa}/` : "", partOfSpeech:collect("dpos",4).map(value=>pos[value] ?? value).join("/"), exampleSentence:example,
    exampleTranslation:exampleTranslation ? decodeDictionaryText(content(exampleTranslation)) : "", source:"Cambridge Dictionary", sourceUrl:`https://dictionary.cambridge.org/dictionary/english-chinese-traditional/${encodeURIComponent(query.toLowerCase())}` };
}

async function readSource(url: URL, signal?: AbortSignal): Promise<Response> {
  let response: Response;
  try {
    response=await fetch(url, { signal:signal ? AbortSignal.any([signal,AbortSignal.timeout(6_000)]) : AbortSignal.timeout(6_000), redirect:"error", headers:{Accept:"application/json,text/html;q=0.9", "Accept-Language":"zh-TW,zh;q=0.9,en;q=0.8"} });
  } catch (error) {
    if(signal?.aborted)throw error;
    if(error instanceof Error && error.name==="TimeoutError")throw new Error("查詢來源逾時，請稍後再試或開啟原網站");
    throw new Error("查詢來源連線失敗或要求重新導向／驗證，請使用原網站");
  }
  if (!response.ok) throw new Error(`${url.hostname.includes("cambridge") ? "劍橋辭典" : url.hostname.includes("google") ? "Google 翻譯" : "Free Dictionary"}${response.status===429 ? "請求過多，請稍後重試" : response.status===403 ? "拒絕這台伺服器存取" : response.status===404 ? "找不到這個單字" : "暫時無法查詢"}（HTTP ${response.status}）`);
  return response;
}
// Ported from youtube-dual-subtitle/service-worker.js: dj=1, LRU and 429 cooldown.
const googleCache=new Map<string,{entry:LookupEntry;expires:number}>();
let googleFallbackUntil=0;
async function googleLookup(query: string, signal?: AbortSignal): Promise<LookupEntry> {
  const chinese=/[\u3400-\u9fff]/.test(query), key=`${chinese ? "zh-TW|en":"en|zh-TW"}|${query.toLowerCase()}`;
  const cached=googleCache.get(key); if(cached && cached.expires>Date.now()) {googleCache.delete(key);googleCache.set(key,cached);return {...cached.entry};}
  const save=(entry:LookupEntry)=>{googleCache.set(key,{entry,expires:Date.now()+24*60*60*1000});while(googleCache.size>600)googleCache.delete(googleCache.keys().next().value!);return {...entry};};
  let primaryError: unknown;
  if(Date.now()>=googleFallbackUntil) {
    const url=new URL("https://translate.googleapis.com/translate_a/single");
    for(const [name,value] of [["client","gtx"],["sl",chinese ? "zh-TW":"en"],["tl",chinese ? "en":"zh-TW"],["dt","t"],["dj","1"],["q",query]])url.searchParams.append(name,value);
    if(!chinese)url.searchParams.append("dt","bd");
    try {const response=await readSource(url,signal);return save(parseGoogleLookup(query,await response.json()));}
    catch(error){if(signal?.aborted)throw error;primaryError=error;if(error instanceof Error && /HTTP 429/.test(error.message))googleFallbackUntil=Date.now()+10*60*1000;}
  }
  const fallback=new URL("https://clients5.google.com/translate_a/t");
  for(const [name,value] of [["client","dict-chrome-ex"],["sl",chinese ? "zh-TW":"en"],["tl",chinese ? "en":"zh-TW"],["q",query]])fallback.searchParams.set(name,value);
  try {const payload=await (await readSource(fallback,signal)).json();const translated=Array.isArray(payload) ? text(payload[0]) : "";if(!translated)throw new Error("Google 備援没有回傳翻譯內容");return save(parseGoogleLookup(query,{sentences:[{trans:translated,orig:query}]}));}
  catch(error){if(signal?.aborted)throw error;throw new Error(`${primaryError instanceof Error ? `${primaryError.message}；` : ""}${error instanceof Error ? error.message : "Google 翻譯失敗"}`);}
}
export async function lookupDictionary(query: string, source: LookupSource, signal?: AbortSignal): Promise<LookupEntry> {
  query=query.trim(); if (!query || query.length>80 || !/^[a-zA-Z\u3400-\u9fff\s'’-]+$/.test(query)) throw new Error("請輸入 80 字內的英文單字、短語或中文解釋");
  const chinese=/[\u3400-\u9fff]/.test(query);
  if (source==="AUTO") { const failures: string[]=[]; for (const provider of (chinese ? ["GOOGLE"] : ["GOOGLE","FREE","CAMBRIDGE"]) as LookupSource[]) { if (signal?.aborted) throw new Error("查詢已取消"); try { return await lookupDictionary(query,provider,signal); } catch (error) { failures.push(error instanceof Error ? error.message : "查詢失敗"); } } throw new Error(failures.join("；")); }
  if (source==="GOOGLE") return googleLookup(query,signal);
  if (chinese) throw new Error("此字典僅支援英文；中文查詢請選擇 Google 翻譯");
  if (source==="CAMBRIDGE") { const url=new URL(`https://dictionary.cambridge.org/dictionary/english-chinese-traditional/${encodeURIComponent(query.toLowerCase())}`); const response=await readSource(url,signal); if (Number(response.headers.get("content-length"))>2_000_000) throw new Error("辭典頁面過大"); const html=await response.text(); if (html.length>2_000_000) throw new Error("辭典頁面過大"); return parseCambridgeLookup(query,html); }
  const response=await readSource(new URL(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(query)}`),signal);
  const entries=await response.json() as {word?:string;phonetic?:string;phonetics?:{text?:string}[];meanings?:{partOfSpeech?:string;definitions?:{definition?:string;example?:string}[]}[]}[];
  const entry=Array.isArray(entries) ? entries[0] : undefined, meaning=entry?.meanings?.[0], definition=meaning?.definitions?.[0]; if (!entry?.word || !definition?.definition) throw new Error("字典沒有可顯示的解釋");
  return {...blank,word:entry.word,definition:definition.definition,phonetic:entry.phonetic ?? entry.phonetics?.find(item=>item.text)?.text ?? "",partOfSpeech:meaning?.partOfSpeech ?? "",exampleSentence:definition.example ?? "",source:"Free Dictionary（英文解釋）",sourceUrl:`https://dictionaryapi.dev/`};
}
