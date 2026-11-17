import type { Card, VocabState } from "./types";
export type CardFields = Pick<Card,"word"|"phonetic"|"partOfSpeech"|"definition"|"exampleSentence"|"exampleTranslation"|"notes">;
export type EditorRow = CardFields & { cardId?: string; rowId: string };
export function editorRowSignature(rows:EditorRow[]):string{return JSON.stringify(rows.map(({rowId,word,definition,phonetic,partOfSpeech,exampleSentence,exampleTranslation,notes})=>({rowId,word:word.trim(),definition:definition.trim(),phonetic,partOfSpeech,exampleSentence,exampleTranslation,notes})));}
export function autosaveEditorRows(cards:Card[],rows:EditorRow[]):{rows:EditorRow[];incomplete:number}{
 let incomplete=0;const complete:EditorRow[]=[];
 for(const row of rows){if(row.word.trim()&&row.definition.trim()){complete.push(row);continue;}if(row.word.trim()||row.definition.trim()||row.cardId)incomplete++;const saved=row.cardId?cards.find(c=>c.id===row.cardId):undefined;if(saved)complete.push({...saved,cardId:saved.id,rowId:row.rowId});}
 return {rows:complete,incomplete};
}

export function commitCardEdits(state: VocabState, deckId: string, rows: EditorRow[], originalIds: string[]): VocabState {
  if (!state.decks.some(deck=>deck.id===deckId)) throw new Error("資料夾已不存在，無法儲存");
  const originals=new Set(originalIds), seen=new Set<string>(), ids=new Set<string>();
  const untouched=state.cards.filter(card=>card.deckId===deckId && !originals.has(card.id)).sort((a,b)=>a.order-b.order);
  untouched.forEach(card=>seen.add(card.word.trim().toLocaleLowerCase()));
  const edited: Card[]=[];
  for (const row of rows) {
    const word=row.word.trim(), definition=row.definition.trim();
    if (!row.cardId && !word && !definition) continue;
    if (!word || !definition) throw new Error(`「${word || "未填單字"}」缺少英文單字或定義，尚未儲存任何變更`);
    const key=word.toLocaleLowerCase(); if (seen.has(key)) throw new Error(`資料夾內有重複單字「${word}」，尚未儲存任何變更`); seen.add(key);
    const existing=row.cardId ? state.cards.find(card=>card.id===row.cardId && card.deckId===deckId) : undefined;
    if (row.cardId && (!originals.has(row.cardId) || !existing || ids.has(row.cardId))) throw new Error("單字資料已變動，請重新開啟編輯畫面");
    if (row.cardId) ids.add(row.cardId);
    const fields: CardFields={ word,definition,phonetic:row.phonetic,partOfSpeech:row.partOfSpeech,exampleSentence:row.exampleSentence,exampleTranslation:row.exampleTranslation,notes:row.notes };
    edited.push(existing ? {...existing,...fields} : {...fields,id:row.rowId,deckId,order:0,mastered:false,favorite:false,suspended:false,mistakeCount:0,nextReviewAt:Date.now()});
  }
  const next=[...edited,...untouched].map((card,order)=>({...card,order}));
  return {...state,cards:[...state.cards.filter(card=>card.deckId!==deckId),...next]};
}
