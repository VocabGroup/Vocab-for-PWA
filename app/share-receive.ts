/** Capability IDs are validated before building any native-app URL. */
export function shareId(hash: string): string {
  const id = hash.replace(/^#/, "");
  if (!/^[a-f0-9]{48}$/.test(id)) throw Error("分享網址不完整，請重新複製連結");
  return id;
}
export function androidShareIntent(id: string, origin: string): string {
  shareId(id);
  const fallback = `${origin}/share?app=unavailable#${id}`;
  return `intent://share/${id}#Intent;scheme=vocab;package=com.aistudio.vocabpulse.srsapp;S.browser_fallback_url=${encodeURIComponent(fallback)};end`;
}
export function receivingEnvironment(userAgent: string, standalone: boolean) {
  if (standalone) return "standalone";
  if (/Line\/|Instagram|FBAN|FBAV/i.test(userAgent)) return "embedded";
  if (/Android/i.test(userAgent)) return "android";
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "ios";
  return "desktop";
}
export function parseShareReceipts(raw:string):Record<string,string[]> {
  try {
    const value:unknown=JSON.parse(raw);
    if(!value||typeof value!=="object"||Array.isArray(value))return {};
    return Object.fromEntries(Object.entries(value).filter(([id,decks])=>/^[a-f0-9]{48}$/.test(id)&&Array.isArray(decks)&&decks.length<=200&&decks.every(deck=>typeof deck==="string"&&deck.length<=100)).slice(-200));
  } catch {return {};}
}
