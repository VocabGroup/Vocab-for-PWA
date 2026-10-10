import type { LookupEntry } from "./dictionary-lookup";

export function ecdictKey(query: string): string {
  const key = query.trim().toLowerCase().replaceAll("’", "'").replaceAll("‘", "'");
  if (!key || key.length > 80 || !/^[a-z '-]+$/.test(key)) throw new Error("ECDICT 支援英文單字或短語；中文請選擇 Google 翻譯");
  return key;
}

export function ecdictShard(key: string): string {
  let hash = 2166136261;
  for (const char of key) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return (hash & 255).toString(16).padStart(2, "0");
}

export async function lookupEcdict(query: string, signal?: AbortSignal): Promise<LookupEntry> {
  const key = ecdictKey(query);
  const response = await fetch(`/ecdict/${ecdictShard(key)}.json`, { signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(8_000)]) : AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error("ECDICT 資料尚未下載，請連線後重試");
  const data: unknown = await response.json();
  const row = data && typeof data === "object" && Object.hasOwn(data, key) ? (data as Record<string, unknown>)[key] : undefined;
  if (!Array.isArray(row) || row.length !== 4 || !row.every(item => typeof item === "string")) throw new Error("ECDICT 查無此單字；可改用其他來源");
  const [word, phonetic, partOfSpeech, definition] = row as string[];
  return { word, phonetic: phonetic ? `/${phonetic}/` : "", partOfSpeech, definition,
    exampleSentence: "", exampleTranslation: "", notes: "ECDICT（MIT）；保留原始中文釋義，部分為簡體；此來源不提供例句。",
    source: "ECDICT 英漢字典", sourceUrl: "https://github.com/skywind3000/ECDICT" };
}
