"use client";

import { useEffect, useMemo, useState } from "react";
import type { Card, QuizRecord, VocabState } from "./types";
import { MdArrowBack, MdCheckCircle, MdVolumeUp } from "react-icons/md";

export type QuizMode =
  | "chineseToEnglish" | "englishToChinese" | "chineseTypeEnglish"
  | "clozeChoice" | "clozeTyping" | "listeningChoice" | "listeningSpelling"
  | "sentenceOrder" | "partOfSpeech" | "synonym" | "match";

const quizModes: Array<{ id: QuizMode; label: string; note: string }> = [
  { id: "chineseToEnglish", label: "中選英", note: "看中文選英文" },
  { id: "englishToChinese", label: "英選中", note: "看英文選中文" },
  { id: "chineseTypeEnglish", label: "中文填英文", note: "輸入完整單字" },
  { id: "clozeChoice", label: "英文克漏字選擇", note: "完成英文例句" },
  { id: "clozeTyping", label: "英文克漏字填空", note: "自行輸入答案" },
  { id: "listeningChoice", label: "聽力選字", note: "聽發音選單字" },
  { id: "listeningSpelling", label: "聽力拼字", note: "聽發音拼完整" },
  { id: "sentenceOrder", label: "句子重組", note: "重新排列例句" },
  { id: "partOfSpeech", label: "詞性選擇", note: "辨認單字詞性" },
  { id: "synonym", label: "近義字辨析", note: "從相近字中判斷" },
  { id: "match", label: "配對", note: "配對英文與中文" },
];

const shuffle = <T,>(items: T[]) => [...items].sort(() => Math.random() - .5);
const scopeCards = (state: VocabState, scope: string) => scope === "__all__" ? state.cards : scope.startsWith("__course__") ? state.cards.filter(card => state.decks.find(deck => deck.id === card.deckId)?.course === scope.slice(10)) : state.cards.filter(card => card.deckId === scope);
const normalized = (value: string) => value.trim().toLocaleLowerCase().replace(/[.!?。！？]$/, "");
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const cloze = (card: Card) => card.exampleSentence.trim()
  ? card.exampleSentence.replace(new RegExp(`\\b${escapeRegExp(card.word)}\\b`, "ig"), "____")
  : "";

function definitionTerms(card: Card) {
  return new Set(card.definition.toLocaleLowerCase().split(/[；;，,、／/\s（）()]+/).map(value => value.trim()).filter(value => value.length >= 2));
}

function relatedCards(card: Card, cards: Card[]) {
  const terms = definitionTerms(card);
  return cards.filter(other => other.id !== card.id && [...definitionTerms(other)].some(term => terms.has(term)));
}

function eligible(mode: QuizMode, cards: Card[]) {
  const active = cards.filter(card => !card.suspended && card.word.trim());
  const distinctWords = new Set(active.map(card => normalized(card.word))).size;
  const distinctDefinitions = new Set(active.map(card => normalized(card.definition)).filter(Boolean)).size;
  const distinctParts = new Set(active.map(card => normalized(card.partOfSpeech)).filter(Boolean)).size;
  switch (mode) {
    case "chineseToEnglish": return distinctWords >= 2 ? active.filter(card => card.definition.trim()) : [];
    case "englishToChinese": return distinctDefinitions >= 2 ? active.filter(card => card.definition.trim()) : [];
    case "chineseTypeEnglish": return active.filter(card => card.definition.trim());
    case "clozeChoice": return distinctWords >= 2 ? active.filter(card => cloze(card).includes("____")) : [];
    case "clozeTyping": return active.filter(card => cloze(card).includes("____"));
    case "listeningChoice": return distinctWords >= 2 ? active : [];
    case "listeningSpelling": return active;
    case "sentenceOrder": return active.filter(card => card.exampleSentence.trim().split(/\s+/).length >= 3);
    case "partOfSpeech": return distinctParts >= 2 ? active.filter(card => card.partOfSpeech.trim()) : [];
    case "synonym": return active.filter(card => card.definition.trim() && relatedCards(card, active).length);
    case "match": return active.length >= 2 ? active : [];
  }
}

function expected(mode: QuizMode, card: Card) {
  if (mode === "englishToChinese") return card.definition;
  if (mode === "partOfSpeech") return card.partOfSpeech;
  return card.word;
}

function choices(mode: QuizMode, card: Card, cards: Card[]) {
  const answer = expected(mode, card).trim();
  let distractors: string[];
  if (mode === "englishToChinese") distractors = cards.map(item => item.definition.trim());
  else if (mode === "partOfSpeech") distractors = cards.map(item => item.partOfSpeech.trim());
  else if (mode === "synonym") distractors = [...relatedCards(card, cards).map(item => item.word), ...cards.map(item => item.word)];
  else distractors = cards.map(item => item.word.trim());
  return shuffle([answer, ...shuffle(distractors.filter(value => value && normalized(value) !== normalized(answer))).filter((value, index, all) => all.findIndex(item => normalized(item) === normalized(value)) === index).slice(0, 3)]);
}

function speak(text: string, rate = 1) {
  window.speechSynthesis?.cancel();
  if (!/^[\x00-\x7F\s'-]+$/.test(text)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  utterance.rate = rate;
  window.speechSynthesis?.speak(utterance);
}

function Frame({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="sheet-backdrop page-backdrop">
    <section className="sheet sheet-wide quiz-sheet" role="main">
      <header><button className="icon-button" aria-label="返回" onClick={onClose}><MdArrowBack size={24} /></button><div className="quiz-frame-title"><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div></header>
      <div className="sheet-body">{children}</div>
    </section>
  </div>;
}

export function AdvancedQuizSheet({ state, initialDeckId, speechRate, onClose, onAnswer, onComplete }: {
  state: VocabState; initialDeckId: string; onClose: () => void;
  speechRate: number;
  onAnswer: (id: string, correct: boolean) => void;
  onComplete: (record: QuizRecord) => void;
}) {
  const initial = initialDeckId || state.decks.find(deck => state.cards.some(card => card.deckId === deck.id))?.id || "";
  const [deckId, setDeckId] = useState(initial);
  const [mode, setMode] = useState<QuizMode | null>(null);
  const [phase, setPhase] = useState<"choose" | "play" | "done">("choose");
  const [questions, setQuestions] = useState<Card[]>([]);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState("");
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState<null | boolean>(null);
  const [score, setScore] = useState(0);
  const [wrong, setWrong] = useState<Set<string>>(new Set());
  const [ordered, setOrdered] = useState<string[]>([]);
  const [available, setAvailable] = useState<string[]>([]);

  const deckCards = useMemo(() => scopeCards(state, deckId), [state, deckId]);
  const card = questions[index];
  const optionList = useMemo(() => card && mode ? choices(mode, card, questions) : [], [mode, card, questions]);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);
  useEffect(() => {
    if (phase === "play" && card && (mode === "listeningChoice" || mode === "listeningSpelling")) speak(card.word, speechRate);
    if (phase === "play" && card && mode === "sentenceOrder") {
      // Reset the interactive word bank when the active question changes.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOrdered([]);
      setAvailable(shuffle(card.exampleSentence.trim().split(/\s+/)));
    }
  }, [phase, card, mode, speechRate]);

  const begin = (selectedMode: QuizMode | null = mode) => {
    if (!selectedMode) return;
    const pool = shuffle(eligible(selectedMode, deckCards));
    setMode(selectedMode);
    setQuestions(pool); setIndex(0); setScore(0); setWrong(new Set()); setSelected(""); setTyped(""); setResult(null);
    setPhase(pool.length ? "play" : "choose");
  };

  const mark = (correct: boolean) => {
    if (!card) return;
    if (!correct) setWrong(current => new Set(current).add(card.id));
    if (correct && result !== true) setScore(current => current + 1);
    setResult(correct);
    onAnswer(card.id, correct);
  };

  const chooseAnswer = (value: string) => {
    if (result !== null) return;
    setSelected(value);
  };

  const confirmChoice = () => {
    if (!selected || result !== null) return;
    mark(normalized(selected) === normalized(expected(mode!, card)));
  };

  const submitTyped = () => {
    if (!typed.trim() || result !== null) return;
    mark(normalized(typed) === normalized(expected(mode!, card)));
  };

  const submitOrder = () => {
    if (!ordered.length || result !== null) return;
    mark(normalized(ordered.join(" ")) === normalized(card.exampleSentence));
  };

  const next = () => {
    if (result === null) return;
    if (index + 1 >= questions.length) {
      const record: QuizRecord = { id: crypto.randomUUID(), deckId, mode: mode!, completedAt: Date.now(), total: questions.length, correct: score, wrongCardIds: [...wrong] };
      onComplete(record); setPhase("done"); return;
    }
    setIndex(value => value + 1); setSelected(""); setTyped(""); setResult(null); setOrdered([]); setAvailable([]);
  };

  if (mode === "match" && phase === "play") {
    return <Frame title="配對" subtitle={`${deckCards.length} 張單字卡`} onClose={onClose}>
      <MatchingGame cards={questions} onAnswer={onAnswer} onDone={(correct, wrongIds) => {
        onComplete({ id: crypto.randomUUID(), deckId, mode, completedAt: Date.now(), total: questions.length, correct, wrongCardIds: wrongIds });
        setScore(correct); setWrong(new Set(wrongIds)); setPhase("done");
      }} />
    </Frame>;
  }

  return <Frame title={phase === "choose" ? "選擇測驗題型" : phase === "done" ? "測驗完成" : quizModes.find(item => item.id === mode)?.label || "測驗"} subtitle={phase === "play" ? `${index + 1} / ${questions.length}` : undefined} onClose={onClose}>
    {phase === "choose" && <div className="quiz-picker">
      <label className="select-label"><span>選擇資料夾</span><select value={deckId} onChange={event => { setDeckId(event.target.value); setMode(null); }}><option value="__all__">全部資料夾（{state.cards.length}）</option>{Array.from(new Set(state.decks.map(deck => deck.course))).map(course => <option key={course} value={`__course__${course}`}>{course}－全部（{scopeCards(state, `__course__${course}`).length}）</option>)}{state.decks.map(deck => <option key={deck.id} value={deck.id}>{deck.name}（{state.cards.filter(card => card.deckId === deck.id).length}）</option>)}</select></label>
      <div className="mode-grid">{quizModes.map(item => {
        const count = eligible(item.id, deckCards).length;
        return <button key={item.id} disabled={!count} onClick={() => begin(item.id)}><strong>{item.label} · {count}</strong><small>{count ? item.note : "目前資料不足"}</small></button>;
      })}</div>
    </div>}

    {phase === "play" && card && mode && <div className="quiz-stage advanced-quiz">
      <Question card={card} mode={mode} speechRate={speechRate} />
      {mode === "sentenceOrder" ? <>
        <div className="sentence-answer">{ordered.length ? ordered.map((token, tokenIndex) => <button key={`${token}-${tokenIndex}`} onClick={() => { setOrdered(values => values.filter((_, i) => i !== tokenIndex)); setAvailable(values => [...values, token]); }}>{token}</button>) : <span>依序點選下方單字組成句子</span>}</div>
        <div className="word-bank">{available.map((token, tokenIndex) => <button key={`${token}-${tokenIndex}`} onClick={() => { setAvailable(values => values.filter((_, i) => i !== tokenIndex)); setOrdered(values => [...values, token]); }}>{token}</button>)}</div>
        {result === null && <button className="primary wide" disabled={!ordered.length} onClick={submitOrder}>確認句子</button>}
      </> : ["chineseTypeEnglish", "clozeTyping", "listeningSpelling"].includes(mode) ? <div className="typing-answer"><input autoFocus autoCapitalize="none" value={typed} disabled={result !== null} onChange={event => setTyped(event.target.value)} onKeyDown={event => event.key === "Enter" && submitTyped()} placeholder={mode === "listeningSpelling" ? "輸入聽到的英文" : "輸入完整英文單字"} /><small>不分大小寫，但必須完整輸入</small>{result === null && <button className="primary" disabled={!typed.trim()} onClick={submitTyped}>確認答案</button>}</div> : <div className="options">{optionList.map(option => <button key={option} className={result !== null && normalized(option) === normalized(expected(mode, card)) ? "correct" : selected === option && result === false ? "wrong" : selected === option ? "selected" : ""} onClick={() => chooseAnswer(option)}>{option}</button>)}</div>}
      {!['sentenceOrder','chineseTypeEnglish','clozeTyping','listeningSpelling'].includes(mode) && <div className={`feedback answer-panel ${result === true ? "good" : result === false ? "bad" : "waiting"}`}><strong>{result === true ? "答對了" : result === false ? `答錯了，答案：${expected(mode, card)}` : "完成後確認答案"}</strong>{result === null ? <button className="primary" disabled={!selected} onClick={confirmChoice}>確認</button> : <button className="primary" onClick={next}>{index + 1 === questions.length ? "查看結果" : "下一題"}</button>}</div>}
      {['sentenceOrder','chineseTypeEnglish','clozeTyping','listeningSpelling'].includes(mode) && result !== null && <div className={`feedback answer-panel ${result ? "good" : "bad"}`}><strong>{result ? "答對了" : `答錯了，答案：${expected(mode, card)}`}</strong><button className="primary" onClick={next}>{index + 1 === questions.length ? "查看結果" : "下一題"}</button></div>}
    </div>}

    {phase === "done" && <div className="completion"><span><MdCheckCircle size={38} /></span><h2>測驗完成</h2><p>答對 {score} / {questions.length} 題</p>{wrong.size > 0 && <p className="wrong-summary">本次有 {wrong.size} 張需要再複習</p>}<button className="primary wide" onClick={() => begin()}>再測一次</button><button className="secondary wide" onClick={onClose}>返回測驗區</button></div>}
  </Frame>;
}

function Question({ card, mode, speechRate }: { card: Card; mode: QuizMode; speechRate: number }) {
  const listening = mode === "listeningChoice" || mode === "listeningSpelling";
  return <div className="question">
    {mode === "chineseToEnglish" || mode === "chineseTypeEnglish" ? <><p className="eyebrow">中文提示</p><h2>{card.definition}</h2>{card.exampleSentence && <p>{cloze(card)}</p>}</> : null}
    {mode === "englishToChinese" ? <><p className="eyebrow">選擇正確中文</p><h2>{card.word}</h2>{card.exampleSentence && <p>{card.exampleSentence}</p>}</> : null}
    {mode === "clozeChoice" || mode === "clozeTyping" || mode === "synonym" ? <><p className="eyebrow">{mode === "synonym" ? "從相近單字中選出最符合者" : "完成例句"}</p><h2 className="cloze-sentence">{cloze(card)}</h2><p>{card.definition}</p></> : null}
    {listening ? <><p className="eyebrow">聽發音作答</p><button className="listen-button" onClick={() => speak(card.word, speechRate)} aria-label="播放發音"><MdVolumeUp size={32} /></button><p>可以重複播放後再作答</p></> : null}
    {mode === "partOfSpeech" ? <><p className="eyebrow">選擇詞性</p><h2>{card.word}</h2>{card.exampleSentence && <p>{card.exampleSentence}</p>}</> : null}
    {mode === "sentenceOrder" ? <><p className="eyebrow">句子重組</p><h2>{card.exampleTranslation || card.definition}</h2><p>依中文提示排列完整英文例句</p></> : null}
  </div>;
}

type Tile = { key: string; cardId: string; side: "word" | "definition"; text: string };

function MatchingGame({ cards, onAnswer, onDone }: { cards: Card[]; onAnswer: (id: string, correct: boolean) => void; onDone: (correct: number, wrongIds: string[]) => void }) {
  const [remaining, setRemaining] = useState(() => shuffle(cards));
  const [active, setActive] = useState<Card[]>(() => shuffle(cards).slice(0, 4));
  const [left, setLeft] = useState<string | null>(null); const [right, setRight] = useState<string | null>(null);
  const [wrongPair, setWrongPair] = useState<string[]>([]); const [correct, setCorrect] = useState(0); const [wrongIds, setWrongIds] = useState<Set<string>>(new Set());
  const tiles = useMemo(() => {
    const words: Tile[] = shuffle(active.map(card => ({ key: `w-${card.id}`, cardId: card.id, side: "word" as const, text: card.word })));
    const definitions: Tile[] = shuffle(active.map(card => ({ key: `d-${card.id}`, cardId: card.id, side: "definition" as const, text: card.definition })));
    return { words, definitions };
  }, [active]);

  const choose = (tile: Tile) => {
    if (wrongPair.length) return;
    const nextLeft = tile.side === "word" ? tile.cardId : left;
    const nextRight = tile.side === "definition" ? tile.cardId : right;
    if (tile.side === "word") setLeft(tile.cardId); else setRight(tile.cardId);
    if (!nextLeft || !nextRight) return;
    if (nextLeft === nextRight) {
      onAnswer(nextLeft, true); const nextCorrect = correct + 1; setCorrect(nextCorrect);
      const usedIds = new Set(active.map(card => card.id));
      const replacement = remaining.find(card => !usedIds.has(card.id));
      const nextActive = active.filter(card => card.id !== nextLeft);
      if (replacement) nextActive.push(replacement);
      const nextRemaining = remaining.filter(card => card.id !== nextLeft && card.id !== replacement?.id);
      setRemaining(nextRemaining); setActive(nextActive); setLeft(null); setRight(null);
      if (!nextActive.length) onDone(nextCorrect, [...wrongIds]);
    } else {
      onAnswer(nextLeft, false); setWrongIds(current => new Set(current).add(nextLeft));
      setWrongPair([`w-${nextLeft}`, `d-${nextRight}`]); window.setTimeout(() => { setWrongPair([]); setLeft(null); setRight(null); }, 560);
    }
  };

  return <div className="matching-stage"><div className="match-progress"><span style={{ width: `${cards.length ? correct / cards.length * 100 : 0}%` }} /></div><p>選擇互相對應的英文與中文</p><div className="match-columns"><div>{tiles.words.map(tile => <button key={tile.key} className={`${left === tile.cardId ? "selected" : ""} ${wrongPair.includes(tile.key) ? "wrong" : ""}`} onClick={() => choose(tile)}>{tile.text}</button>)}</div><div>{tiles.definitions.map(tile => <button key={tile.key} className={`${right === tile.cardId ? "selected" : ""} ${wrongPair.includes(tile.key) ? "wrong" : ""}`} onClick={() => choose(tile)}>{tile.text}</button>)}</div></div></div>;
}
