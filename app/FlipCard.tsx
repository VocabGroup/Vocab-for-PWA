"use client";
import { useRef, useState } from "react";
import { MdStar, MdStarBorder, MdVolumeUp } from "react-icons/md";
import type { Card } from "./types";

export function FlipCard({ card, flipped, onFlip, onRate, onFavorite, onSpeak }: { card: Card; flipped: boolean; onFlip: () => void; onRate: (remembered: boolean) => void; onFavorite: () => void; onSpeak: (text: string) => void }) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);
  const [offset, setOffset] = useState(0);
  return <div className="swipe-card-wrap" style={{ transform: `translateX(${offset}px) rotate(${Math.max(-12, Math.min(12, offset / 20))}deg)` }}
    onPointerDown={event => { if ((event.target as HTMLElement).closest("button")) return; start.current = { x: event.clientX, y: event.clientY }; moved.current = false; }}
    onPointerMove={event => { if (!start.current) return; const dx = event.clientX - start.current.x; const dy = event.clientY - start.current.y; if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) { moved.current = true; event.currentTarget.setPointerCapture(event.pointerId); setOffset(dx); } }}
    onPointerUp={event => { if (!start.current) return; const dx = event.clientX - start.current.x; start.current = null; setOffset(0); if (moved.current && Math.abs(dx) > 90) onRate(dx > 0); }}
    onPointerCancel={() => { start.current = null; moved.current = true; setOffset(0); }}>
    {offset > 45 && <span className="swipe-badge remembered">記得</span>}{offset < -45 && <span className="swipe-badge unfamiliar">不熟</span>}
    <div className="flip-perspective"><div className={`flip-rotor ${flipped ? "is-flipped" : ""}`} role="button" tabIndex={0} aria-label={flipped ? "翻回單字卡正面" : "翻到單字卡背面"} aria-pressed={flipped}
      onClick={event => { if (!(event.target as HTMLElement).closest("button") && !moved.current) onFlip(); }} onKeyDown={event => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onFlip(); } }}>
      <article className="android-flashcard flip-face front" aria-hidden={flipped} inert={flipped}><header><span>{card.partOfSpeech || "單字卡"}</span><button aria-label={card.favorite ? "取消收藏" : "加入收藏"} onClick={onFavorite}>{card.favorite ? <MdStar size={23} /> : <MdStarBorder size={23} />}</button></header><div className="card-center"><h2>{card.word}</h2>{card.phonetic && <p>{card.phonetic}</p>}<button className="speak-pill" onClick={() => onSpeak(card.word)}><MdVolumeUp size={21} />發音</button></div><small>點一下翻面 · 左滑：不熟 · 右滑：記得</small></article>
      <article className="android-flashcard flip-face back" aria-hidden={!flipped} inert={!flipped}><header><span><strong>{card.word}</strong>　{card.partOfSpeech}</span><button aria-label="朗讀例句" onClick={() => onSpeak(`${card.word}. ${card.exampleSentence}`)}><MdVolumeUp size={22} /></button></header><div className="card-back-content"><h3>{card.definition}</h3>{card.exampleSentence && <section><b>例句</b><p>{card.exampleSentence}</p><small>{card.exampleTranslation}</small></section>}{card.notes && <p className="card-notes">註記：{card.notes}</p>}</div><small>點一下回正面</small></article>
    </div></div>
  </div>;
}
