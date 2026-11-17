"use client";
import {confirmAction} from "./ConfirmationDialog";

import { useMemo, useState } from "react";
import type { Card, VocabState } from "./types";
import { CardActionMenu } from "./CardActionMenu";
import {useLongPress} from "./use-long-press";
import {useDialogFocus} from "./use-share-dialog-focus";
import {WordOrderHandle} from "./WordOrderHandle";
import { speakText } from "./speech";
import {MultiSelectIcon,SelectAllIcon} from "./SelectionIcons";
import { MdAdd, MdArrowBack, MdCheck, MdChevronRight, MdClose, MdDelete, MdVolumeUp, MdDriveFileMove, MdFolder, MdSearch, MdContentCopy, MdShare } from "react-icons/md";

export function ManageCardsSheet({ state, deckId, onEdit, onClose, onAdd, onImport, onScan, onUpdate, onDelete, onMove, onCopy, onStudy, onQuiz, onReorder }: {
  state: VocabState; deckId: string; onEdit: (card: Card) => void; onClose: () => void; onAdd: () => void;
  onImport: () => void; onScan: () => void;
  onUpdate: (card: Card) => void; onDelete: (ids: string[]) => void; onMove: (ids: string[], deckId: string) => void;
  onCopy:(ids:string[],deckId:string)=>void;onReorder:(ids:string[])=>void;
  onStudy: (scope: string) => void; onQuiz: (scope: string) => void;
}) {
  const [query, setQuery] = useState(""); const [filter, setFilter] = useState<"all" | "due" | "favorite">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set()); const [deleting, setDeleting] = useState<Card | null>(null);
  const [moveOpen, setMoveOpen] = useState(false);
  const [copying,setCopying]=useState(false);
  const [addModeOpen, setAddModeOpen] = useState(false);
  useDialogFocus(!!deleting||moveOpen||addModeOpen,()=>{setDeleting(null);setMoveOpen(false);setAddModeOpen(false);},'.manage-sheet .nested-dialog');
  const [multiMode, setMultiMode] = useState(false);
  const [scopeDeck, setScopeDeck] = useState(deckId); const [course, setCourse] = useState(state.decks.find(item => item.id === deckId)?.course ?? "__all__");
  const [now] = useState(() => Date.now());
  const deckCards = useMemo(() => state.cards.filter(card => (scopeDeck === "__all__" ? course === "__all__" || state.decks.find(deck => deck.id === card.deckId)?.course === course : card.deckId === scopeDeck)).sort((a, b) => a.order - b.order), [state.cards, state.decks, scopeDeck, course]);
  const visible = deckCards.filter(card => {
    const matches = !query.trim() || `${card.word} ${card.definition}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
    if (!matches) return false;
    if (filter === "due") return card.nextReviewAt <= now && !card.mastered && !card.suspended;
    if (filter === "favorite") return card.favorite;
    return true;
  });
  function activateCard(card: Card) {
    if (!multiMode) { onEdit(card); return; }
    setSelected(current => { const next = new Set(current); if (next.has(card.id)) next.delete(card.id); else next.add(card.id); return next; });
  }
  const studyScope = scopeDeck === "__all__" && course !== "__all__" ? `__course__${course}` : scopeDeck;

  return <div className="sheet-backdrop page-backdrop">
    <section className="sheet sheet-wide manage-sheet" role="main">
      <header className={multiMode?"selection-header":""}>{multiMode?<><button className="icon-button" aria-label="完成多選" onClick={()=>{setMultiMode(false);setSelected(new Set());}}><MdClose/></button><h2>已選取 {selected.size}</h2><button className="icon-button" aria-label="全選單字" onClick={()=>setSelected(new Set(visible.map(c=>c.id)))}><SelectAllIcon/></button><button className="icon-button" aria-label="複製單字" disabled={!selected.size} onClick={()=>{setCopying(true);setMoveOpen(true);}}><MdContentCopy/></button><button className="icon-button" aria-label="移動單字" disabled={!selected.size} onClick={()=>{setCopying(false);setMoveOpen(true);}}><MdDriveFileMove/></button><button className="icon-button" aria-label="刪除選取單字" disabled={!selected.size} onClick={async()=>{if(await confirmAction("刪除所選單字？")){onDelete([...selected]);setSelected(new Set());}}}><MdDelete/></button></>:<><button className="icon-button" aria-label="返回" onClick={onClose}><MdArrowBack size={24}/></button><div className="manage-title"><h2><span className="context-title">{scopeDeck!=="__all__"&&<>{state.decks.find(deck=>deck.id===scopeDeck)?.course}<MdChevronRight/></>}{state.decks.find(deck=>deck.id===scopeDeck)?.name??"全部單字"}</span></h2><small>{deckCards.length} 個單字</small></div><button className="icon-button" aria-label="多選管理" onClick={()=>setMultiMode(true)}><MultiSelectIcon/></button><button className="icon-button" aria-label="分享資料夾" disabled={scopeDeck==="__all__"} onClick={()=>window.dispatchEvent(new CustomEvent("vocab-share-folder",{detail:scopeDeck}))}><MdShare/></button></>}</header>
      <div className="sheet-body manage-body">
        <div className="manage-selectors"><select aria-label="篩選課程" value={course} onChange={event => { setCourse(event.target.value); setScopeDeck("__all__"); setSelected(new Set()); }}><option value="__all__">全部課程</option>{Array.from(new Set(state.decks.map(deck => deck.course))).map(name => <option key={name} value={name}>{name}</option>)}</select><select aria-label="篩選資料夾" value={scopeDeck} onChange={event => { setScopeDeck(event.target.value); setSelected(new Set()); }}><option value="__all__">全部資料夾</option>{state.decks.filter(deck => course === "__all__" || deck.course === course).map(deck => <option key={deck.id} value={deck.id}>{deck.name}</option>)}</select></div>
        <div className="manage-toolbar"><label className="search-box"><MdSearch size={20} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜尋單字或解釋" />{query && <button aria-label="清除搜尋" onClick={() => setQuery("")}><MdClose size={18} /></button>}</label></div>
        <div className="folder-study-actions"><button className="secondary" disabled={!deckCards.length} onClick={()=>onStudy(studyScope)}>學習</button><button className="secondary" disabled={!deckCards.length} onClick={()=>onQuiz(studyScope)}>測驗</button></div>
        <div className="chips compact-chips"><button className={filter === "all" ? "selected" : ""} onClick={() => setFilter("all")}>全部（{deckCards.length}）</button><button className={filter === "due" ? "selected" : ""} onClick={() => setFilter("due")}>待複習（{deckCards.filter(card => card.nextReviewAt <= now && !card.mastered).length}）</button><button className={filter === "favorite" ? "selected" : ""} onClick={() => setFilter("favorite")}>收藏（{deckCards.filter(card => card.favorite).length}）</button></div>
        {visible.length === 0 ? <div className="empty small-empty"><MdFolder size={38} /><h3>{deckCards.length ? "找不到符合的單字" : "這裡還沒有單字"}</h3><p>{deckCards.length ? "換個關鍵字試試看。" : "點右下角新增或匯入。"}</p></div> : <div className="manage-card-list">{visible.map(card => <HoldCard key={card.id} onHold={()=>{setMultiMode(true);setSelected(new Set([card.id]));}} className={selected.has(card.id) ? "selected" : ""} onClick={event => { if (!(event.target as HTMLElement).closest("button")) activateCard(card); }}>
          <div className="manage-card-top">{multiMode && <button className="select-card" aria-label={selected.has(card.id) ? "取消選取" : "選取單字"} onClick={() => setSelected(current => { const next = new Set(current); if (next.has(card.id)) next.delete(card.id); else next.add(card.id); return next; })}>{selected.has(card.id) ? <MdCheck size={17} /> : null}</button>}
          <button className="card-content" onClick={() => activateCard(card)}><strong>{card.word}</strong><small>{[card.partOfSpeech, card.phonetic].filter(Boolean).join(" · ")}</small></button>
          <button className="icon-button" aria-label={`發音 ${card.word}`} onClick={() => void speakText(card.word, state.settings.speechRate)}><MdVolumeUp size={24} /></button>
          {!multiMode&&scopeDeck!=="__all__"&&<WordOrderHandle word={card.word} onMove={offset=>{const ids=visible.map(c=>c.id),index=ids.indexOf(card.id);ids.splice(Math.max(0,Math.min(ids.length-1,index+offset)),0,...ids.splice(index,1));let cursor=0;onReorder(deckCards.map(c=>ids.includes(c.id)?ids[cursor++]:c.id));}}/>}
          <CardActionMenu card={card} onEdit={() => onEdit(card)} onFavorite={() => onUpdate({...card, favorite:!card.favorite})} onSpeak={() => void speakText(card.word,state.settings.speechRate)} onDelete={() => setDeleting(card)} /></div>
          <p>{card.definition}</p>{card.exampleSentence && <small>{card.exampleSentence}</small>}

        </HoldCard>)}</div>}

      </div>
      {!multiMode&&<button className="fab manage-add-fab" aria-label="新增單字卡" onClick={()=>setAddModeOpen(true)}><MdAdd size={26}/></button>}
      {deleting && <div className="nested-dialog-backdrop"><section className="nested-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-card-title"><header><h3 id="delete-card-title">刪除單字卡？</h3><button className="icon-button" aria-label="關閉" onClick={()=>setDeleting(null)}><MdClose/></button></header><p>確定要刪除「{deleting.word}」嗎？這個動作無法復原。</p><div className="dialog-actions"><button className="secondary" onClick={() => setDeleting(null)}>取消</button><button className="danger-button" onClick={() => { onDelete([deleting.id]); setDeleting(null); }}>刪除</button></div></section></div>}
      {moveOpen && <MoveDialog copying={copying} state={state} currentDeckId={scopeDeck} onClose={() => setMoveOpen(false)} onMove={targetId => { if(copying)onCopy([...selected],targetId);else onMove([...selected], targetId);setMultiMode(false); setSelected(new Set()); setMoveOpen(false); }} />}
      {addModeOpen && <div className="nested-dialog-backdrop"><section className="nested-dialog add-mode-dialog" role="dialog" aria-modal="true" aria-label="新增單字卡方式"><header><h3>新增單字卡</h3><button className="icon-button" aria-label="關閉" onClick={() => setAddModeOpen(false)}><MdClose size={22} /></button></header><div className="add-mode-list"><button onClick={onAdd}><strong>手動輸入單字</strong><small>批次輸入或 AI 補齊</small></button><button onClick={onImport}><strong>匯入線上單字集</strong><small>分享網址、搜尋或匯出檔案</small></button><button onClick={onScan}><strong>掃描或匯入文件</strong><small>拍照、相片或 PDF</small></button></div></section></div>}
    </section>
  </div>;
}

function MoveDialog({ state, currentDeckId, onClose, onMove, copying=false }: { copying?:boolean;state: VocabState; currentDeckId: string; onClose: () => void; onMove: (deckId: string) => void }) {
  return <div className="nested-dialog-backdrop"><section className="nested-dialog" role="dialog" aria-modal="true" aria-label={copying?"複製到其他資料夾":"移動到其他資料夾"}><header><h3>{copying?"複製到其他資料夾":"移動到其他資料夾"}</h3><button className="icon-button" aria-label="關閉" onClick={onClose}><MdClose size={22} /></button></header><div className="move-list">{state.decks.filter(deck => deck.id !== currentDeckId).map(deck => <button key={deck.id} onClick={() => onMove(deck.id)}><span className="deck-dot" style={{ background: deck.color }} /><span><strong>{deck.name}</strong><small>{deck.course} · {state.cards.filter(card => card.deckId === deck.id).length} 張</small></span><MdChevronRight size={22} /></button>)}{state.decks.length <= 1 && <p>目前沒有其他資料夾，請先新增資料夾。</p>}</div></section></div>;
}

function HoldCard({onHold,children,...props}:{onHold:()=>void;children:React.ReactNode;className:string;onClick:React.MouseEventHandler<HTMLElement>}){const hold=useLongPress(onHold);return <article {...props} {...hold}>{children}</article>;}
