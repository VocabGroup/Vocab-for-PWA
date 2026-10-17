import type { Card, Deck, VocabState } from "./types";

const fields = ["word", "phonetic", "partOfSpeech", "definition", "exampleSentence", "exampleTranslation", "notes"] as const;
export type SharedCard = Pick<Card, typeof fields[number]>;
export type SharedDeck = Pick<Deck, "name" | "course" | "description" | "color"> & { cards: SharedCard[] };
export type FolderShare = { format: "vocab-folder-share"; version: 1; decks: SharedDeck[] };
function text(value: unknown, limit = 20000): string {
  if (value !== undefined && typeof value !== "string") throw new Error("分享檔文字欄位格式錯誤");
  if ((value as string | undefined)?.length && (value as string).length > limit) throw new Error("分享檔欄位過長");
  return (value as string | undefined)?.trim() ?? "";
}
export function exportFolders(state: VocabState, ids: string[], notes = false): FolderShare {
  return { format: "vocab-folder-share", version: 1, decks: state.decks.filter(deck => ids.includes(deck.id)).sort((a,b) => a.order-b.order).map(deck => ({
    name: deck.name, course: deck.course, description: deck.description ?? "", color: deck.color,
    cards: state.cards.filter(card => card.deckId === deck.id).sort((a,b) => a.order-b.order).map(card => Object.fromEntries(fields.map(key => [key, key === "notes" && !notes ? "" : card[key]])) as SharedCard),
  })) };
}
export function parseFolderShare(raw: string): FolderShare {
  if (new TextEncoder().encode(raw).length > 20 * 1024 * 1024) throw new Error("分享檔超過 20 MB");
  const value = JSON.parse(raw);
  if (value?.format !== "vocab-folder-share" || value.version !== 1 || !Array.isArray(value.decks) || !value.decks.length || value.decks.length > 200) throw new Error("請選擇 Vocab 資料夾分享檔，不是完整備份");
  let total = 0;
  const decks = value.decks.map((deck: Record<string, unknown>) => {
    if (!deck || typeof deck !== "object" || !Array.isArray(deck.cards)) throw new Error("資料夾格式錯誤");
    total += deck.cards.length;
    if (total > 20000) throw new Error("單次最多匯入 20,000 張單字卡");
    const cards = deck.cards.map((card: Record<string, unknown>) => {
      if (!card || typeof card !== "object") throw new Error("單字格式錯誤");
      const result = Object.fromEntries(fields.map(key => [key, text(card[key], key === "word" ? 200 : 20000)])) as SharedCard;
      if (!result.word || !result.definition) throw new Error("單字或解釋不可空白");
      return result;
    });
    const name = text(deck.name, 200); if (!name) throw new Error("資料夾名稱不可空白");
    const color = text(deck.color, 30);
    return { name, course: text(deck.course, 200) || "通用", description: text(deck.description), color: /^#[\da-f]{6}$/i.test(color) ? color : "#426B63", cards };
  });
  return { format: "vocab-folder-share", version: 1, decks };
}
export function importFolders(state: VocabState, share: FolderShare, course: string, skipDuplicates: boolean, id:()=>string = () => crypto.randomUUID(), deckIds?:string[]): {state: VocabState; ids: string[]} {
  const now = Date.now(), decks = [...state.decks], cards = [...state.cards], ids: string[] = [];
  const known = new Set(cards.map(card => card.word.trim().toLowerCase()));
  for (const source of share.decks) {
    const targetCourse = course.trim() || source.course;
    let name = source.name, suffix = 1;
    while (decks.some(deck => deck.course === targetCourse && deck.name === name)) name = `${source.name}（匯入${suffix++ === 1 ? "" : suffix-1}）`;
    const deckId = deckIds?.[ids.length] ?? id(); ids.push(deckId);
    decks.push({ id: deckId, name, course: targetCourse, description: source.description, color: source.color, order: Math.max(-1,...decks.map(deck=>deck.order))+1, createdAt: now });
    const seen = new Set<string>(); let order = 0;
    for (const draft of source.cards) {
      const key = draft.word.trim().toLowerCase();
      if (seen.has(key) || (skipDuplicates && known.has(key))) continue;
      seen.add(key); known.add(key);
      cards.push({ ...draft, id: id(), deckId, order: order++, mastered: false, favorite: false, suspended: false, mistakeCount: 0, intervalDays: 0, easeFactor: 2.5, repetitionCount: 0, nextReviewAt: now, createdAt: now });
    }
  }
  return { state: {...state,decks,cards}, ids };
}
export async function shareFolderFile(share: FolderShare) {
  const file = new File([JSON.stringify(share,null,2)], "Vocab.vocab-share.json", {type:"application/json"});
  if (navigator.canShare?.({files:[file]})) { await navigator.share({files:[file],title:"Vocab 資料夾"}); return; }
  const url = URL.createObjectURL(file), link = document.createElement("a"); link.href=url;link.download=file.name;link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
