"use client";
import { useEffect, useRef, useState } from "react";
import { MdAdd, MdArrowBack, MdAutoAwesome, MdClose, MdHistory, MdSearch, MdVolumeUp } from "react-icons/md";
import type { Card, VocabState } from "./types";
import type { LookupEntry } from "./dictionary-lookup";
import { speakText } from "./speech";
import { mergeCardCompletion } from "./card-completion";
import { lookupBrowserDictionary } from "./browser-dictionary";

type Entry = LookupEntry;
const historyKey = "vocab-word-search-history";

export function WordLookupScreen({ state, onClose, onOpenCard, onAdd, onComplete }: { state: VocabState; onClose: () => void; onOpenCard: (card: Card) => void; onAdd: (entry: Entry, deckId: string) => void; onComplete: (entry: Entry) => Promise<Partial<Card>> }) {
  const [query, setQuery] = useState(""); const [searched, setSearched] = useState(""); const [history, setHistory] = useState<string[]>([]);
  const [result, setResult] = useState<Entry | null>(null); const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const [picker, setPicker] = useState(false); const [aiBusy, setAiBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const [source, setSource] = useState(state.settings.dictionarySource ?? "AUTO");
  useEffect(() => { try { const saved: unknown = JSON.parse(localStorage.getItem(historyKey) ?? "[]"); if (Array.isArray(saved)) Promise.resolve().then(() => setHistory(saved.filter((item): item is string => typeof item === "string").slice(0, 30))); } catch {} return () => abort.current?.abort(); }, []);
  function saveHistory(next: string[]) { setHistory(next); try { localStorage.setItem(historyKey, JSON.stringify(next)); } catch { setError("搜尋紀錄無法儲存；單字資料不受影響。"); } }
  async function search(value = query) {
    const term = value.trim(); if (!term) return; abort.current?.abort(); const controller = new AbortController(); abort.current = controller;
    setQuery(term); setSearched(term); setResult(null); setError(""); saveHistory([term, ...history.filter(item => item !== term)].slice(0, 30));
    setLoading(true);
    const timeout = setTimeout(() => controller.abort(), 40_000);
    try {
      const entry = await lookupBrowserDictionary(term,source,controller.signal);
      if (abort.current === controller) setResult({ ...entry, notes:[`來源：${entry.source}`, entry.notes].filter(Boolean).join("\n") });
    } catch (cause) { if (abort.current === controller) setError(controller.signal.aborted ? "字典查詢逾時，請稍後重試或使用下方的原網站；本機結果仍可使用。" : cause instanceof Error ? cause.message : "線上查詢失敗；仍可查看本機結果。"); }
    finally { clearTimeout(timeout); if (abort.current === controller) setLoading(false); }
  }
  const matches = searched ? state.cards.filter(card => `${card.word} ${card.definition}`.toLocaleLowerCase().includes(searched.toLocaleLowerCase())) : [];
  return <div className="sheet-backdrop page-backdrop"><section className="sheet sheet-wide lookup-screen" role="main"><header><button className="icon-button" aria-label="返回" onClick={onClose}><MdArrowBack size={24} /></button><form className="lookup-search" onSubmit={event => { event.preventDefault(); void search(); }}><input autoFocus aria-label="搜尋英文單字或中文解釋" placeholder="搜尋英文單字或中文解釋" value={query} onChange={event => { abort.current?.abort(); abort.current=null; setLoading(false); setQuery(event.target.value); setSearched(""); }} autoCapitalize="none" enterKeyHint="search" /><button className="icon-button" aria-label="搜尋" disabled={!query.trim() || loading}>{loading ? <span className="spinner" /> : <MdSearch size={24} />}</button></form></header>
    <div className="sheet-body lookup-body"><label className="lookup-source-selector"><span>查詢來源</span><select aria-label="查詢來源" value={source} onChange={event => { abort.current?.abort(); abort.current=null; setLoading(false); setSource(event.target.value as typeof source); setResult(null); setError(""); setSearched(""); }}><option value="AUTO">自動選擇（優先 ECDICT）</option><option value="ECDICT">ECDICT 英漢字典</option><option value="GOOGLE">Google 翻譯（中英雙向）</option><option value="CAMBRIDGE">劍橋英漢辭典</option><option value="FREE">Free Dictionary（英文解釋）</option>{source === "WIKTIONARY" && <option value="WIKTIONARY">維基詞典（尚未移植）</option>}</select></label>{!searched ? <><div className="lookup-history-heading"><h3>搜尋紀錄</h3>{!!history.length && <button onClick={() => saveHistory([])}>全部清除</button>}</div>{history.map(item => <div className="lookup-history" key={item}><MdHistory size={24} /><button onClick={() => void search(item)}>{item}</button><button className="icon-button" aria-label={`刪除搜尋紀錄 ${item}`} onClick={() => saveHistory(history.filter(value => value !== item))}><MdClose size={24} /></button></div>)}{!history.length && <p className="hint">ECDICT 提供英漢釋義；Google 支援中英雙向翻譯。同時搜尋自己的單字庫。</p>}</> : <>
      {error && <p role="alert">{error}</p>}{!!matches.length && <><h3>我的單字庫</h3>{matches.map(card => <button className="lookup-local" key={card.id} onClick={() => onOpenCard(card)}><strong>{card.word}</strong><span>{[card.partOfSpeech, card.phonetic].filter(Boolean).join(" · ")}</span><p>{card.definition}</p>{card.exampleSentence && <small>{card.exampleSentence}</small>}</button>)}</>}
      {loading && <p role="status">正在查詢線上字典…</p>}{result && <><h3>{result.source}</h3><article className="lookup-result"><div><h2>{result.word}</h2><button className="icon-button" aria-label="發音" onClick={() => void speakText(result.word, state.settings.speechRate)}><MdVolumeUp size={24} /></button></div><span>{result.partOfSpeech}　{result.phonetic}</span><h3>{result.definition}</h3>{result.exampleSentence && <p>{result.exampleSentence}</p>}{result.exampleTranslation && <p>{result.exampleTranslation}</p>}<small>資料來源：<a href={result.sourceUrl} target="_blank" rel="noopener noreferrer">{result.source}</a></small><div className="lookup-actions"><button className="secondary" disabled={aiBusy} onClick={async () => { setAiBusy(true); try { const enriched = await onComplete(result); setResult(current => current ? mergeCardCompletion(current, enriched) : current); } catch (cause) { setError(`AI 補齊失敗：${cause instanceof Error ? cause.message : "請检查設定"}`); } finally { setAiBusy(false); } }}><MdAutoAwesome />{aiBusy ? "補齊中" : "AI 補齊"}</button><button className="primary" disabled={!state.decks.length} onClick={() => setPicker(true)}><MdAdd />加入資料夾</button></div>{!state.decks.length && <p className="hint">請先建立資料夾，再加入查詢結果。</p>}</article></>}
      {!loading && !matches.length && !result && !error && <p>找不到符合的結果</p>}
      <div className="lookup-external"><p>來源暫時無法查詢時，也可以開啟原網站：</p><a href={`https://dictionary.cambridge.org/zht/詞典/英語-漢語-繁體/${encodeURIComponent(searched)}`} target="_blank" rel="noopener noreferrer">劍橋英漢辭典</a><a href={`https://translate.google.com/?sl=en&tl=zh-TW&text=${encodeURIComponent(searched)}&op=translate`} target="_blank" rel="noopener noreferrer">Google 翻譯</a></div>
    </>}</div>
    {picker && result && <div className="nested-dialog-backdrop"><section className="nested-dialog"><header><h3>加入資料夾</h3><button className="icon-button" aria-label="取消" onClick={() => setPicker(false)}><MdClose /></button></header><div className="move-list">{state.decks.map(deck => <button key={deck.id} onClick={() => { onAdd(result, deck.id); setPicker(false); }}><MdAdd /><span>{deck.course} · {deck.name}</span></button>)}</div></section></div>}
  </section></div>;
}
