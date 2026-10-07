"use client";

import { useMemo, useState } from "react";
import type { Card, VocabState } from "./types";
import { CardActionMenu } from "./CardActionMenu";
import { speakText } from "./speech";
import { MdAdd, MdArrowBack, MdCheck, MdChevronRight, MdClose, MdDelete, MdEditNote, MdVolumeUp, MdDriveFileMove, MdFolder, MdSearch } from "react-icons/md";

export function ManageCardsSheet({ state, deckId, onEdit, onClose, onAdd, onImport, onScan, onUpdate, onDelete, onMove, onStudy, onQuiz }: {
  state: VocabState; deckId: string; onEdit: (card: Card) => void; onClose: () => void; onAdd: () => void;
  onImport: () => void; onScan: () => void;
  onUpdate: (card: Card) => void; onDelete: (ids: string[]) => void; onMove: (ids: string[], deckId: string) => void;
  onStudy: (scope: string) => void; onQuiz: (scope: string) => void;
}) {
  const [query, setQuery] = useState(""); const [filter, setFilter] = useState<"all" | "due" | "favorite">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set()); const [deleting, setDeleting] = useState<Card | null>(null);
  const [moveOpen, setMoveOpen] = useState(false); 
  const [addModeOpen, setAddModeOpen] = useState(false);
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
  const multi = multiMode;
  function activateCard(card: Card) {
    if (!multiMode) { onEdit(card); return; }
    setSelected(current => { const next = new Set(current); if (next.has(card.id)) next.delete(card.id); else next.add(card.id); return next; });
  }
  const studyScope = scopeDeck === "__all__" && course !== "__all__" ? `__course__${course}` : scopeDeck;

  return <div className="sheet-backdrop page-backdrop">
    <section className="sheet sheet-wide manage-sheet" role="main">
      <header><button className="icon-button" aria-label="返回" onClick={onClose}><MdArrowBack size={24} /></button><div className="manage-title"><h2>單字卡 · {deckCards.length}</h2></div><div className="manage-top-actions"><button className="icon-button" aria-label={multiMode ? "完成多選" : "多選管理"} onClick={() => { setMultiMode(value => !value); setSelected(new Set()); }}><MdEditNote size={24} /></button></div></header>
      <div className="sheet-body manage-body">
        <div className="manage-selectors"><select aria-label="篩選課程" value={course} onChange={event => { setCourse(event.target.value); setScopeDeck("__all__"); setSelected(new Set()); }}><option value="__all__">全部課程</option>{Array.from(new Set(state.decks.map(deck => deck.course))).map(name => <option key={name} value={name}>{name}</option>)}</select><select aria-label="篩選資料夾" value={scopeDeck} onChange={event => { setScopeDeck(event.target.value); setSelected(new Set()); }}><option value="__all__">全部資料夾</option>{state.decks.filter(deck => course === "__all__" || deck.course === course).map(deck => <option key={deck.id} value={deck.id}>{deck.name}</option>)}</select></div>
        <div className="manage-toolbar"><label className="search-box"><MdSearch size={20} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="搜尋單字或解釋" />{query && <button aria-label="清除搜尋" onClick={() => setQuery("")}><MdClose size={18} /></button>}</label></div>
        {!!deckCards.length && <div className="manage-start-actions"><button className="secondary" onClick={() => onStudy(studyScope)}>學習</button><button className="primary" onClick={() => onQuiz(studyScope)}>測驗</button></div>}
        <div className="chips compact-chips"><button className={filter === "all" ? "selected" : ""} onClick={() => setFilter("all")}>全部（{deckCards.length}）</button><button className={filter === "due" ? "selected" : ""} onClick={() => setFilter("due")}>待複習（{deckCards.filter(card => card.nextReviewAt <= now && !card.mastered).length}）</button><button className={filter === "favorite" ? "selected" : ""} onClick={() => setFilter("favorite")}>收藏（{deckCards.filter(card => card.favorite).length}）</button></div>
        {multi && <div className="multi-bar"><strong>已選 {selected.size} 張</strong><button aria-label="移動" onClick={() => setMoveOpen(true)}><MdDriveFileMove size={19} />移動</button><button className="danger" aria-label="刪除選取單字" onClick={() => { if (confirm("刪除選取的單字卡？")) { onDelete([...selected]); setSelected(new Set()); } }}><MdDelete size={19} />刪除</button><button onClick={() => setSelected(new Set())}>取消</button></div>}
        {visible.length === 0 ? <div className="empty small-empty"><MdFolder size={38} /><h3>{deckCards.length ? "找不到符合的單字" : "這裡還沒有單字"}</h3><p>{deckCards.length ? "換個關鍵字試試看。" : "點右下角新增或匯入。"}</p></div> : <div className="manage-card-list">{visible.map(card => <article key={card.id} className={selected.has(card.id) ? "selected" : ""} onClick={event => { if (!(event.target as HTMLElement).closest("button")) activateCard(card); }}>
          <div className="manage-card-top">{multiMode && <button className="select-card" aria-label={selected.has(card.id) ? "取消選取" : "選取單字"} onClick={() => setSelected(current => { const next = new Set(current); if (next.has(card.id)) next.delete(card.id); else next.add(card.id); return next; })}>{selected.has(card.id) ? <MdCheck size={17} /> : null}</button>}
          <button className="card-content" onClick={() => activateCard(card)}><strong>{card.word}</strong><small>{[card.partOfSpeech, card.phonetic].filter(Boolean).join(" · ")}</small></button>
          <button className="icon-button" aria-label={`發音 ${card.word}`} onClick={() => void speakText(card.word, state.settings.speechRate)}><MdVolumeUp size={24} /></button>
          <CardActionMenu card={card} onEdit={() => onEdit(card)} onFavorite={() => onUpdate({...card, favorite:!card.favorite})} onSpeak={() => void speakText(card.word,state.settings.speechRate)} onDelete={() => setDeleting(card)} /></div>
          <p>{card.definition}</p>{card.exampleSentence && <small>{card.exampleSentence}</small>}

        </article>)}</div>}

        {!multiMode && <button className="fab manage-fab" onClick={() => setAddModeOpen(true)} aria-label="新增單字卡"><MdAdd size={24} /></button>}
      </div>
      {deleting && <div className="nested-dialog-backdrop"><section className="nested-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-card-title"><h3 id="delete-card-title">刪除單字卡？</h3><p>確定要刪除「{deleting.word}」嗎？這個動作無法復原。</p><div className="dialog-actions"><button className="secondary" onClick={() => setDeleting(null)}>取消</button><button className="danger-button" onClick={() => { onDelete([deleting.id]); setDeleting(null); }}>刪除</button></div></section></div>}
      {moveOpen && <MoveDialog state={state} currentDeckId={deckId} onClose={() => setMoveOpen(false)} onMove={targetId => { onMove([...selected], targetId); setSelected(new Set()); setMoveOpen(false); }} />}
      {addModeOpen && <div className="nested-dialog-backdrop"><section className="nested-dialog add-mode-dialog"><header><h3>新增單字卡</h3><button className="icon-button" aria-label="關閉" onClick={() => setAddModeOpen(false)}><MdClose size={22} /></button></header><div className="add-mode-list"><button onClick={onAdd}><strong>手動輸入單字</strong><small>批次輸入或 AI 補齊</small></button><button onClick={onImport}><strong>匯入線上單字集</strong><small>分享網址、搜尋或匯出檔案</small></button><button onClick={onScan}><strong>掃描或匯入文件</strong><small>拍照、相片或 PDF</small></button></div></section></div>}
    </section>
  </div>;
}

function MoveDialog({ state, currentDeckId, onClose, onMove }: { state: VocabState; currentDeckId: string; onClose: () => void; onMove: (deckId: string) => void }) {
  return <div className="nested-dialog-backdrop"><section className="nested-dialog"><header><h3>移動到其他資料夾</h3><button className="icon-button" aria-label="關閉" onClick={onClose}><MdClose size={22} /></button></header><div className="move-list">{state.decks.filter(deck => deck.id !== currentDeckId).map(deck => <button key={deck.id} onClick={() => onMove(deck.id)}><span className="deck-dot" style={{ background: deck.color }} /><span><strong>{deck.name}</strong><small>{deck.course} · {state.cards.filter(card => card.deckId === deck.id).length} 張</small></span><MdChevronRight size={22} /></button>)}{state.decks.length <= 1 && <p>目前沒有其他資料夾，請先新增資料夾。</p>}</div></section></div>;
}
