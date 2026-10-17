"use client";
/* eslint-disable @next/next/no-img-element -- Selected photos are local blob URLs, not server images. */

import { ChangeEvent, FormEvent, useEffect, useEffectEvent, useRef, useState } from "react";
import type { AppSettings, Card, Deck, VocabState } from "./types";
import { downloadBackup, emptyState } from "./storage";
import { clearLearningSessions, loadDeviceState, saveDeviceState } from "./device-storage";
import { localDateKey, recordCardReview, scheduleReview, streakStats, undoCardReview } from "./learning";
import { cancelSpeech, selectSpeechVoice, speakText } from "./speech";
import { AdvancedQuizSheet } from "./AdvancedQuizSheet";
import { ManageCardsSheet } from "./ManageCardsSheet";
import { CollectionRow, ListRow } from "./ParityUi";
import { OnboardingScreen } from "./OnboardingScreen";
import { SettingsScreen } from "./SettingsScreen";
import { requestAi, partialReply } from "./ai-client";
import {FolderSharing} from "./FolderSharing";
import {prepareAiFile,scanInstructions,type ScanMode} from "./image-preparation";
import {generateCoveredArticle,missingArticleWords,articleHighlights,type ArticleDraft} from "./article-coverage";
import { mergeCardCompletion } from "./card-completion";
import { cardSpeechParts } from "./card-speech";
import { FlipCard } from "./FlipCard";
import { WordLookupScreen } from "./WordLookupScreen";
import { DocumentScanner } from "./DocumentScanner";
import { BrowserExperience } from "./BrowserExperience";
import { ImportDeviceHelp } from "./ImportDeviceHelp";
import { parseCardJson } from "./import-json";
import { commitCardEdits, type EditorRow } from "./card-editing";
import {
  MdAdd, MdArrowBack, MdAutoAwesome, MdCameraAlt, MdClose, MdExtension,
  MdFolder, MdHome, MdImportExport, MdPlayArrow, MdSettings, MdStyle,
  MdCheckCircle, MdSearch, MdDelete, MdEdit,
  MdAttachFile, MdSend, MdStop,
  MdPause, MdUndo, MdDocumentScanner, MdDownload, MdCollectionsBookmark, MdPhotoLibrary,
} from "react-icons/md";
import type { IconType } from "react-icons";

type Tab = "home" | "folders" | "study" | "quiz";
type Sheet = "none" | "deck" | "card" | "manage" | "study" | "quiz" | "settings" | "ai" | "import" | "scan" | "lookup";
type CardDraft = Pick<Card, "word" | "phonetic" | "partOfSpeech" | "definition" | "exampleSentence" | "exampleTranslation" | "notes">;
type ChatMessage = { role: "user" | "assistant"; text: string };
type AiAction = { type: string; [key: string]: unknown };

const blankCard: CardDraft = {
  word: "", phonetic: "", partOfSpeech: "", definition: "",
  exampleSentence: "", exampleTranslation: "", notes: "",
};

const todayKey = localDateKey;
const makeId = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
const normalize = (value: string) => value.trim().toLocaleLowerCase();
const scopedCards = (state: VocabState, scope: string) => scope === "__all__" ? state.cards : scope.startsWith("__course__") ? state.cards.filter(card => state.decks.find(deck => deck.id === card.deckId)?.course === scope.slice(10)) : state.cards.filter(card => card.deckId === scope);

function Icon({ icon: Glyph, size = 24 }: { icon: IconType; size?: number }) {
  return <Glyph className="icon" size={size} aria-hidden="true" />;
}

export function VocabApp() {
  const [state, setState] = useState<VocabState>(emptyState);
  const [ready, setReady] = useState(false);
  const [previewOnboarding, setPreviewOnboarding] = useState(false);
  const [tab, setTab] = useState<Tab>("home");
  const [sheet, setSheet] = useState<Sheet>("none");
  const [selectedDeckId, setSelectedDeckId] = useState<string>("");
  const [lookupCard, setLookupCard] = useState<Card | null>(null);
  const [toast, setToast] = useState("");
  const [now] = useState(() => Date.now());
  const [storageError, setStorageError] = useState("");
  const [lastImport,setLastImport]=useState<{cards:string[];decks:string[]}|null>(null);
  const backend = useRef<"indexeddb" | "localstorage">("indexeddb");

  useEffect(() => {
    let cancelled = false;
    loadDeviceState().then(loaded => {
      if (cancelled) return;
      setPreviewOnboarding(new URLSearchParams(location.search).get("preview") === "onboarding");
      backend.current = loaded.backend;
      setState(loaded.state); setReady(true);
    }).catch(error => { if (!cancelled) setStorageError(`無法讀取本機資料：${error instanceof Error ? error.message : "請重新開啟 Vocab"}`); });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    saveDeviceState(state, backend.current).then(() => { if (!cancelled) setStorageError(""); })
      .catch(() => { if (!cancelled) setStorageError("本機儲存失敗，最新變更尚未保存。請先下載備份，再確認裝置儲存空間。"); });
    return () => { cancelled = true; };
  }, [state, ready]);
  useEffect(() => {
    const closePage = () => {if(document.documentElement.dataset.aiBusy==="true"&&!confirm("AI 作業仍在進行，離開會取消，是否繼續？")){history.pushState({vocabPage:"lookup"},"");return;}setSheet(history.state?.vocabPage === "settings" ? "settings" : "none");};
    window.addEventListener("popstate", closePage);
    return () => window.removeEventListener("popstate", closePage);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const current = (history.state ?? {}) as Record<string, unknown>;
    if (sheet !== "none") {
      if (current.vocabPage) history.replaceState({ ...current, vocabPage: sheet }, "");
      else history.pushState({ ...current, vocabPage: sheet }, "");
    } else if (current.vocabPage) {
      const next = { ...current }; delete next.vocabPage; history.replaceState(next, "");
    }
  }, [sheet, ready]);
  useEffect(() => {
    const root = document.documentElement;
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      root.dataset.theme = state.settings.theme === "system" ? (systemTheme.matches ? "dark" : "light") : state.settings.theme === "custom" ? "light" : state.settings.theme;
      const themeColor = getComputedStyle(root).getPropertyValue("--bg").trim();
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", themeColor);
    };
    applyTheme(); systemTheme.addEventListener("change", applyTheme);
    const customKeys = ["--bg", "--bg-deep", "--primary", "--primary-strong", "--text"];
    customKeys.forEach(key => root.style.removeProperty(key));
    if (state.settings.theme === "custom") {
      root.style.setProperty("--bg", state.settings.customBackground);
      root.style.setProperty("--bg-deep", state.settings.customBackground);
      root.style.setProperty("--primary", state.settings.customPrimary);
      root.style.setProperty("--primary-strong", state.settings.customPrimary);
    }
    if (state.settings.gradientEnabled) {
      root.style.setProperty("--bg", state.settings.gradientStart);
      root.style.setProperty("--bg-deep", state.settings.gradientEnd);
    }
    if (state.settings.customTextEnabled) root.style.setProperty("--text", state.settings.customText);
    root.style.setProperty("--font-scale", String(state.settings.fontScale));
    root.style.setProperty("--app-font", state.settings.fontFamily === "serif" ? 'Georgia, "Noto Serif TC", serif' : state.settings.fontFamily === "monospace" ? '"SFMono-Regular", Consolas, monospace' : 'system-ui, "PingFang TC", "Noto Sans TC", sans-serif');
    root.dataset.largeText = String(state.settings.fontScale >= 1.3);
    root.style.setProperty("--background-brightness", String(state.settings.backgroundBrightness));
    root.style.setProperty("--background-opacity", String(state.settings.backgroundOpacity));
    selectSpeechVoice(state.settings.ttsVoiceName, state.settings.ttsVoiceStyle);
    applyTheme();
    return () => systemTheme.removeEventListener("change", applyTheme);
  }, [state.settings]);
  useEffect(() => {
    if (!state.settings.remindersEnabled || typeof Notification === "undefined") return;
    let sending = false;
    const check = async () => {
      if (Notification.permission !== "granted") return;
      const now = new Date(); const current = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const key = `vocab-reminder-${todayKey()}-${current}`;
      if (sending) return;
      if ((state.settings.reminderTimes ?? [state.settings.reminderTime]).includes(current)) {
        const studied = state.logs.find(log => log.date === todayKey())?.count ?? 0;
        if (studied >= state.settings.dailyGoal) return;
        sending = true;
        try {
          if (localStorage.getItem(key)) return;
          const options = { body: `今天已完成 ${studied} / ${state.settings.dailyGoal} 張，回來背幾個單字吧。`, icon: "/icon-192.png", tag: key };
          const registration = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
          if (registration) await registration.showNotification("今天還沒達到目標", options);
          else new Notification("今天還沒達到目標", options);
          localStorage.setItem(key, "sent");
        } catch { /* Mobile browsers may only permit service-worker notifications. */ }
        finally { sending = false; }
      }
    };
    check(); const timer = window.setInterval(check, 30_000); return () => window.clearInterval(timer);
  }, [state.settings.remindersEnabled, state.settings.reminderTime, state.settings.reminderTimes, state.settings.dailyGoal, state.logs]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const todayStudied = state.logs.find(log => log.date === todayKey())?.count ?? 0;
  const dueCount = state.cards.filter(card => !card.suspended && card.nextReviewAt <= now).length;
  const activeDeck = state.decks.find(deck => deck.id === selectedDeckId);

  const updateSettings = (patch: Partial<AppSettings>) =>
    setState(current => ({ ...current, settings: { ...current.settings, ...patch } }));

  const recordStudy = (amount = 1) => setState(current => {
    const date = todayKey();
    const found = current.logs.some(log => log.date === date);
    return {
      ...current,
      logs: found
        ? current.logs.map(log => log.date === date ? { ...log, count: log.count + amount } : log)
        : [...current.logs, { date, count: amount }],
    };
  });

  const editCard = (card: Card) => { setLookupCard(card); setSelectedDeckId(card.deckId); setSheet("card"); };
  const openCard = (deckId?: string) => {
    setLookupCard(null);
    const id = state.decks.find(deck => deck.id === (deckId || selectedDeckId))?.id || state.decks[0]?.id || "";
    setSelectedDeckId(id);
    setSheet(state.decks.length ? "card" : "deck");
    if (!state.decks.length) setToast("請先建立一個資料夾");
  };

  const startForDeck = (deckId: string, destination: "study" | "quiz") => {
    setSelectedDeckId(deckId);
    setSheet(destination);
  };

  const finishImport = (cards: Partial<CardDraft>[], deckId: string, newFolder=false) => {
    const source=state.decks.find(d=>d.id===deckId);if(!source)return;
    const importedDeckId=newFolder?makeId():deckId;
    const seen = new Set(state.cards.filter(card => card.deckId === deckId).map(card => normalize(card.word)));
    if(newFolder)seen.clear();
    const accepted = cards.filter(draft => { const key = normalize(draft.word || ""); if (!key || seen.has(key)) return false; seen.add(key); return true; });
    const ids=accepted.map(()=>makeId());
    setState(current => {
      const startOrder = current.cards.filter(card => card.deckId === importedDeckId).length;
      return { ...current,decks:newFolder?[...current.decks,{...source,id:importedDeckId,name:`${source.name}（辨識匯入 ${new Date().toLocaleTimeString()}）`,order:current.decks.length,createdAt:Date.now()}]:current.decks, cards: [...current.cards, ...accepted.map((draft, index) => ({ ...blankCard, ...draft, id: ids[index], deckId:importedDeckId, order: startOrder + index, mastered: false, favorite: false, suspended: false, mistakeCount: 0,intervalDays:0,easeFactor:2.5,repetitionCount:0,lastReviewedAt:undefined, nextReviewAt: Date.now() }))] };
    });
    setLastImport({cards:ids,decks:newFolder?[importedDeckId]:[]});
    setToast(accepted.length ? `已依原始順序匯入 ${accepted.length} 張單字卡` : "沒有新增：資料夾內已有相同單字");
    setSheet("none");
  };

  if (!ready) return <main className="loading">{storageError ? <section className="storage-error" role="alert"><h1>暫時無法開啟資料</h1><p>{storageError}</p><p>原有資料沒有被清除。</p><button className="primary" onClick={() => location.reload()}>重新開啟</button></section> : <span className="spinner" aria-label="載入資料" />}</main>;
  if (!state.settings.onboardingDone || previewOnboarding) {
    return <BrowserExperience settings={state.settings} updateSettings={updateSettings}><OnboardingScreen preview={previewOnboarding} onComplete={(dailyGoal, remindersEnabled) => {
      if (previewOnboarding) { setPreviewOnboarding(false); history.replaceState(history.state, "", location.pathname); return; }
      setState(current => ({ ...current, settings: { ...current.settings, onboardingDone: true, dailyGoal, remindersEnabled, reminderTime: "20:00", reminderTimes: ["20:00"] } }));
    }} /></BrowserExperience>;
  }

  return (
    <BrowserExperience settings={state.settings} updateSettings={updateSettings}><main className="app-shell">
      {lastImport&&<div className="import-undo"><button className="secondary" onClick={()=>{if(state.cards.some(c=>lastImport.decks.includes(c.deckId)&&!lastImport.cards.includes(c.id))){setToast("匯入資料夾已有其他字卡，請先移出再撤回");return;}if(!confirm("撤回上次單字匯入？該批新字卡及後續修改會移除，原有字卡保留。"))return;setState(current=>({...current,cards:current.cards.filter(c=>!lastImport.cards.includes(c.id)),decks:current.decks.filter(d=>!lastImport.decks.includes(d.id)),reviewLogs:current.reviewLogs?.filter(log=>!lastImport.cards.includes(log.cardId))}));setLastImport(null);}}>撤回上次單字匯入</button></div>}
      {storageError && <div className="storage-error" role="alert"><p>{storageError}</p><button className="secondary" onClick={() => downloadBackup(state)}>下載備份</button></div>}
      <div className="app-content" aria-hidden={sheet !== "none"} inert={sheet !== "none"}>
      <header className="topbar">
        <h1>{tab === "home" ? "Vocab" : tab === "folders" ? "資料夾" : tab === "study" ? "學習" : "測驗"}</h1>
        <div className="header-actions">
          <button className="icon-button" aria-label="搜尋單字" onClick={() => { setLookupCard(null); setSheet("lookup"); }}><Icon icon={MdSearch} /></button>
          <button className="icon-button ai-icon" aria-label="Vocab AI" onClick={() => setSheet("ai")}><Icon icon={MdAutoAwesome} /></button>
          <button className="icon-button" aria-label="設定" onClick={() => setSheet("settings")}><Icon icon={MdSettings} /></button>
        </div>
      </header>

      <section className={`page page-${tab}`} key={tab}>
        {tab === "home" && <HomeView
          state={state} todayStudied={todayStudied} dueCount={dueCount}
          onAddCard={() => openCard()} onScan={() => setSheet("scan")} onImport={() => setSheet("import")}
          onStudy={() => setSheet("study")} onQuiz={() => setSheet("quiz")}
          onAddFolder={() => setSheet("deck")} onOpen={id => { setLookupCard(null); setSelectedDeckId(id); setSheet("manage"); }}
        />}
        {tab === "folders" && <FoldersView state={state} onStateChange={setState} onAdd={() => setSheet("deck")}
          onOpen={id => { setLookupCard(null); setSelectedDeckId(id); setSheet("manage"); }} onStudy={id => startForDeck(id, "study")}
          onQuiz={id => startForDeck(id, "quiz")} onAddCard={openCard}
          onUpdate={updated => setState(current => ({ ...current, decks: current.decks.map(deck => deck.id === updated.id ? updated : deck) }))}
          onRenameCourse={(oldName, newName) => setState(current => ({ ...current, decks: current.decks.map(deck => deck.course === oldName ? { ...deck, course:newName } : deck) }))}
          onReorder={ids => setState(current => ({ ...current, decks: current.decks.map(deck => ({ ...deck, order: ids.indexOf(deck.id) })) }))}
          onDelete={id => setState(current => ({ ...current, decks: current.decks.filter(deck => deck.id !== id), cards: current.cards.filter(card => card.deckId !== id) }))}
        />}
        {tab === "study" && <HubView kind="study" state={state}
          onStudy={id => startForDeck(id, "study")} onQuiz={id => startForDeck(id, "quiz")} onManage={id => { setLookupCard(null); setSelectedDeckId(id); setSheet("manage"); }} />}
        {tab === "quiz" && <HubView kind="quiz" state={state}
          onStudy={id => startForDeck(id, "study")} onQuiz={id => startForDeck(id, "quiz")} onManage={id => { setLookupCard(null); setSelectedDeckId(id); setSheet("manage"); }} />}
      </section>

      <nav className="bottom-nav" aria-label="主要導覽">
        {([
          ["home", MdHome, "主畫面"], ["folders", MdFolder, "資料夾"], ["study", MdStyle, "學習"], ["quiz", MdExtension, "測驗"],
        ] as const).map(([value, icon, label]) => (
          <button key={value} className={tab === value ? "active" : ""} onClick={() => setTab(value)}>
            <Icon icon={icon} /><span>{label}</span>
          </button>
        ))}
      </nav>
      </div>

      {sheet === "deck" && <DeckSheet state={state} onClose={() => setSheet("none")} onSave={(name, course, description, color) => {
        const deck: Deck = { id: makeId(), name, course: course || "未分類", description, color, order: state.decks.length, createdAt: Date.now() };
        setState(current => ({ ...current, decks: [...current.decks, deck] }));
        setSelectedDeckId(deck.id); setSheet("none"); setToast("資料夾已建立");
      }} />}
      {sheet === "card" && <CardSheet key={lookupCard ? `edit-${selectedDeckId}` : "add"} state={state} deck={activeDeck} cards={state.cards} initialCardId={lookupCard?.id} onDeckChange={setSelectedDeckId} onClose={() => { setSheet(lookupCard ? "manage" : "none"); setLookupCard(null); }} onCommit={(rows, originalIds) => { try { setState(commitCardEdits(state, selectedDeckId, rows, originalIds)); setToast("所有單字卡變更已儲存"); return true; } catch (error) { setToast(error instanceof Error ? error.message : "無法儲存"); return false; } }} onSave={draft => {
        if (!activeDeck) return false;
        if (state.cards.some(card => card.deckId === activeDeck.id && normalize(card.word) === normalize(draft.word))) {
          setToast("這個資料夾已經有相同單字"); return false;
        }
        setState(current => { const card: Card = { ...draft, id: makeId(), deckId: activeDeck.id, order: current.cards.filter(item => item.deckId === activeDeck.id).length, mastered: false, favorite: false, suspended: false, mistakeCount: 0, nextReviewAt: Date.now() }; return { ...current, cards: [...current.cards, card] }; });
        setToast("單字卡已儲存"); return true;
      }} />}
      {sheet === "lookup" && <WordLookupScreen state={state} onClose={() => setSheet("none")} onOpenCard={editCard} onAdd={(entry, deckId) => finishImport([entry], deckId)} onComplete={entry => fetchWordDetails(state, entry.word, entry)} />}
      {sheet === "manage" && (activeDeck || selectedDeckId === "__all__") && <ManageCardsSheet state={state} onEdit={editCard} deckId={selectedDeckId} onClose={() => setSheet("none")} onAdd={() => openCard()}
        onImport={() => setSheet("import")} onScan={() => setSheet("scan")}
        onUpdate={updated => {
          if (state.cards.some(card => card.id !== updated.id && card.deckId === updated.deckId && normalize(card.word) === normalize(updated.word))) { setToast("同一個資料夾不能有重複單字"); return; }
          setState(current => ({ ...current, cards: current.cards.map(card => card.id === updated.id ? updated : card) })); setToast("單字卡已更新");
        }}
        onDelete={ids => setState(current => ({ ...current, cards: current.cards.filter(card => !ids.includes(card.id)) }))}
        onMove={(ids, targetDeckId) => setState(current => {
          const moving = current.cards.filter(card => ids.includes(card.id));
          const existing = new Set(current.cards.filter(card => card.deckId === targetDeckId && !ids.includes(card.id)).map(card => normalize(card.word)));
          const duplicates = new Set(moving.filter(card => existing.has(normalize(card.word))).map(card => card.id));
          let order = current.cards.filter(card => card.deckId === targetDeckId && !ids.includes(card.id)).length;
          return { ...current, cards: current.cards.filter(card => !duplicates.has(card.id)).map(card => ids.includes(card.id) ? { ...card, deckId: targetDeckId, order: order++ } : card) };
        })}
        onStudy={scope => startForDeck(scope, "study")} onQuiz={scope => startForDeck(scope, "quiz")} />}
      {sheet === "study" && <StudySheet state={state} initialDeckId={selectedDeckId} onClose={() => setSheet("none")}
        onRate={(cardId, remembered) => {
          setState(current => recordCardReview(current, cardId, remembered ? 3 : 1));
        }} onUndo={original => setState(current => undoCardReview(current, original))} onToggleFavorite={cardId => setState(current => ({ ...current,cards:current.cards.map(card => card.id === cardId ? { ...card,favorite:!card.favorite } : card) }))} autoSpeak={state.settings.autoSpeak} speechRate={state.settings.speechRate} onQuiz={deckId => { setSelectedDeckId(deckId); setSheet("quiz"); }} />}
      {sheet === "quiz" && <AdvancedQuizSheet state={state} initialDeckId={selectedDeckId} speechRate={state.settings.speechRate} onClose={() => setSheet("none")}
        onAnswer={(id, correct) => {
          setState(current => ({ ...current, cards: current.cards.map(card => card.id === id ? {
            ...(correct || !current.settings.gameMistakesToReview ? card : scheduleReview(card, 1)), mistakeCount: correct ? card.mistakeCount : card.mistakeCount + 1,
          } : card) }));
          recordStudy();
        }} onComplete={record => setState(current => ({ ...current, quizRecords: [record, ...(current.quizRecords ?? [])].slice(0, 100) }))} />}
      {sheet === "settings" && <SettingsScreen state={state} updateSettings={updateSettings} onClose={() => setSheet("none")}
        onBackup={() => downloadBackup(state)} onRestore={next => { setState(current => ({ ...next, settings: { ...next.settings, aiApiKey: current.settings.aiProvider === next.settings.aiProvider ? current.settings.aiApiKey : "", aiProfiles: current.settings.aiProfiles?.length ? current.settings.aiProfiles : current.settings.aiApiKey ? [{ id: makeId(), provider: current.settings.aiProvider, model: current.settings.aiModel, key: current.settings.aiApiKey }] : [] } })); setToast("備份已還原"); }}
        onClear={() => { clearLearningSessions(); setState(emptyState); setSheet("none"); }} />}
      {sheet === "ai" && <AiSheet state={state} onClose={() => setSheet("none")} onSettings={() => setSheet("settings")} onApply={action => {
        let message = "操作已完成";
        setState(current => {
          const scope = String(action.__scope || "all");
          const allowedDeckIds = scope === "all" ? new Set(current.decks.map(deck => deck.id)) : new Set([scope]);
          if (action.type === "sortAlphabetically") {
            const ids = new Set(((action.deckIds as string[] | undefined) ?? []).filter(id => allowedDeckIds.has(id))); const targets = ids.size ? ids : allowedDeckIds;
            const orderByDeck = new Map<string, Map<string, number>>(); targets.forEach(deckId => orderByDeck.set(deckId, new Map(current.cards.filter(card => card.deckId === deckId).sort((a, b) => a.word.localeCompare(b.word, "en", { sensitivity: "base" })).map((card, index) => [card.id, index]))));
            message = `已完成 ${targets.size} 個資料夾的字母排序`; return { ...current, cards: current.cards.map(card => orderByDeck.get(card.deckId)?.has(card.id) ? { ...card, order: orderByDeck.get(card.deckId)!.get(card.id)! } : card) };
          }
          if (action.type === "createDeck") {
            const name = String(action.name || "新資料夾"); const course = String(action.course || "未分類"); const deckId = makeId();
            const drafts = Array.isArray(action.cards) ? action.cards as Array<Partial<CardDraft>> : [];
            message = `已建立「${name}」${drafts.length ? `並加入 ${drafts.length} 張單字卡` : ""}`;
            return { ...current, decks: [...current.decks, { id: deckId, name, course, color: "#4f8f83", order: current.decks.length, createdAt: Date.now() }], cards: [...current.cards, ...drafts.filter(item => item.word && item.definition).map((item, index) => ({ ...blankCard, ...item, id: makeId(), deckId, order: index, mastered: false, favorite: false, suspended: false, mistakeCount: 0, nextReviewAt: Date.now() }))] };
          }
          if (action.type === "renameDeck") {
            const deckId = String(action.deckId || ""); const name = String(action.name || "").trim(); const course = String(action.course || "").trim();
            message = "資料夾名稱與課程已更新"; return { ...current, decks: current.decks.map(deck => deck.id === deckId ? { ...deck, name: name || deck.name, course: course || deck.course } : deck) };
          }
          if (action.type === "updateCards") {
            const updates = Array.isArray(action.updates) ? action.updates as Array<Partial<Card> & { id?: string; word?: string }> : [];
            message = `已更新 ${updates.length} 張單字卡`; return { ...current, cards: current.cards.map(card => { if (!allowedDeckIds.has(card.deckId)) return card; const update = updates.find(item => item.id === card.id || (!item.id && normalize(item.word || "") === normalize(card.word))); return update ? { ...card, ...update, id: card.id, deckId: card.deckId } : card; }) };
          }
          if (action.type === "moveCards") {
            const targetDeckId = String(action.targetDeckId || ""); const words = new Set(((action.words as string[] | undefined) ?? []).map(normalize)); let order = current.cards.filter(card => card.deckId === targetDeckId).length;
            const existing = new Set(current.cards.filter(card => card.deckId === targetDeckId).map(card => normalize(card.word))); message = `已移動 ${words.size} 個指定單字`;
            const isSource = (card: Card) => card.deckId !== targetDeckId && allowedDeckIds.has(card.deckId) && words.has(normalize(card.word));
            return { ...current, cards: current.cards.filter(card => !(isSource(card) && existing.has(normalize(card.word)))).map(card => isSource(card) ? { ...card, deckId: targetDeckId, order: order++ } : card) };
          }
          message = "這項操作尚未支援自動執行"; return current;
        });
        return message;
      }} />}
      {sheet === "import" && <ImportSheet state={state} onClose={() => setSheet("none")} onImport={finishImport} />}
      {sheet === "scan" && <ScanSheet state={state} onClose={() => setSheet("none")} onImport={finishImport} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </main></BrowserExperience>
  );
}


function HomeView({ state, todayStudied, dueCount, onAddCard, onScan, onImport, onStudy, onQuiz, onAddFolder, onOpen }: {
  state: VocabState; todayStudied: number; dueCount: number;
  onAddCard: () => void; onScan: () => void; onImport: () => void; onStudy: () => void; onQuiz: () => void; onAddFolder: () => void; onOpen: (id: string) => void;
}) {
  const [course, setCourse] = useState<string | null>(null);
  const goalProgress = Math.min(100, Math.round(todayStudied / state.settings.dailyGoal * 100));
  const streak = calculateStreak(state);
  const recentDays = Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(); date.setDate(date.getDate() - (6 - offset));
    const key = localDateKey(date);
    return { key, label: "日一二三四五六"[date.getDay()], count: state.logs.find(log => log.date === key)?.count ?? 0 };
  });
  const maxDay = Math.max(5, ...recentDays.map(day => day.count));
  const mastered = state.cards.filter(card => card.mastered).length;
  const ratio = state.cards.length ? mastered / state.cards.length : 0;
  const dailyXp = (state.reviewLogs ?? []).filter(log => localDateKey(new Date(log.reviewedAt)) === localDateKey()).reduce((sum, log) => sum + [0, 5, 8, 10, 12][log.rating], 0);
  return <>
    <div className="dashboard-intro"><h2>繼續今天的學習</h2><p>每天一點，讓英文成為習慣。</p></div>
    <article className="dashboard-progress">
      <header><h2>今日進度</h2><small>連續 {streak} 天</small></header>
      <div className="dashboard-total">{todayStudied} / {state.settings.dailyGoal}</div>
      <div className="progress-track"><span style={{ width: `${goalProgress}%` }} /></div>
      <p>待複習 {dueCount} 張 · {dailyXp} XP</p>
      <button className="primary" disabled={!state.cards.length} onClick={onStudy}>開始複習</button>
    </article>
    <div className="dashboard-actions">
      <button className="tonal" onClick={onAddCard}><MdAdd size={24} />新增單字</button>
      <button className="tonal" onClick={onScan}><MdDocumentScanner size={24} />掃描匯入</button>
    </div>
    <ListRow title="匯入單字集" subtitle="連結、檔案或貼上文字" icon={MdDownload} onClick={onImport} />
    <ListRow title="測驗" subtitle="選擇資料夾，練習記憶與應用" icon={MdExtension} onClick={onQuiz} />
    <div className="modern-section"><h2>我的單字庫</h2><button className="icon-button" aria-label="新增資料夾" onClick={onAddFolder}><MdAdd size={24} /></button></div>
    <div className="chips home-filter"><button className={course === null ? "selected" : ""} onClick={() => setCourse(null)}>全部</button>{Array.from(new Set(state.decks.map(deck => deck.course))).map(value => <button key={value} className={course === value ? "selected" : ""} onClick={() => setCourse(value)}>{value}</button>)}</div>
    <ListRow title="所有單字" subtitle={`${state.cards.length} 張 · 已精通 ${mastered} 張`} icon={MdCollectionsBookmark} onClick={() => onOpen("__all__")} />
    {[...state.decks].sort((a,b) => a.order-b.order).filter(deck => course === null || deck.course === course).map(deck => <ListRow key={deck.id} title={deck.name} subtitle={`${deck.course} · ${state.cards.filter(card => card.deckId === deck.id).length} 張`} icon={MdFolder} onClick={() => onOpen(deck.id)} />)}
    <article className="statistics-card parity-statistics">
      <h2>學習進度</h2>
      <div className="statistics-summary"><div><strong>{state.cards.length}</strong><small>總數</small></div><div><strong>{mastered}</strong><small>精通</small></div><div><strong>{dueCount}</strong><small>到期</small></div></div>
      <p className="statistics-caption">精通 {Math.floor(ratio * 100)}%</p><div className="progress-track mastery-track"><span style={{width:`${ratio * 100}%`}} /></div>
      <p className="statistics-caption">近 7 天</p>
      <div className="weekly-chart">{recentDays.map(day => <div key={day.key}><b>{day.count || "\u00a0"}</b><span className={day.count ? "" : "zero"} style={{ height: `${Math.max(.1, day.count / maxDay) * 58}px` }} /><small>週{day.label}</small></div>)}</div>
    </article>
  </>;
}

function FoldersView({ state, onStateChange, onAdd, onOpen, onStudy, onQuiz, onUpdate, onRenameCourse, onReorder, onDelete }: {
  onStateChange:(change:(state:VocabState)=>VocabState)=>void;
  state: VocabState; onAdd: () => void; onOpen: (id: string) => void; onStudy: (id: string) => void; onQuiz: (id: string) => void;
  onAddCard: (id: string) => void; onUpdate: (deck: Deck) => void; onRenameCourse: (oldName: string, newName: string) => void; onReorder: (ids: string[]) => void; onDelete: (id: string) => void;
}) {
  const [course, setCourse] = useState("全部");
  const [editingDeck, setEditingDeck] = useState<Deck | null>(null);
  const [adding,setAdding]=useState(false);
  const [renamingCourse, setRenamingCourse] = useState<string | null>(null); const [courseName, setCourseName] = useState("");
  const courses = ["全部", ...Array.from(new Set(state.decks.map(deck => deck.course)))];
  const decks = state.decks.filter(deck => course === "全部" || deck.course === course).sort((a, b) => a.order - b.order);
  const shiftDeck = (id: string, offset: number) => { const visibleIds = decks.map(deck => deck.id); const index = visibleIds.indexOf(id); const target = Math.max(0, Math.min(visibleIds.length - 1, index + offset)); if (index < 0 || target === index) return; visibleIds.splice(index, 1); visibleIds.splice(target, 0, id); const scope = new Set(visibleIds); let cursor = 0; const ids = [...state.decks].sort((a, b) => a.order - b.order).map(deck => scope.has(deck.id) ? visibleIds[cursor++] : deck.id); onReorder(ids); };
  return <>
    <FolderSharing state={state} course={course} onChange={onStateChange}/>
    <div className="modern-filter"><p>選擇課程</p><div className="chips">{courses.map(value => <button key={value} className={course === value ? "selected" : ""} onClick={() => setCourse(value)}>{value === "全部" ? `全部資料夾 (${state.decks.length})` : `${value} (${state.decks.filter(deck => deck.course === value).length})`}</button>)}</div></div>
    {course !== "全部" && <button className="secondary wide rename-course-button" onClick={() => { setRenamingCourse(course); setCourseName(course); }}><MdEdit size={18} />重新命名課程「{course}」</button>}
    {decks.length === 0 ? <Empty title="還沒有資料夾" text="點右下角新增第一個資料夾。" /> :
      <div className="modern-stack">{decks.map(deck => {
        const cards = state.cards.filter(card => card.deckId === deck.id);
        const mastered = cards.filter(card => card.mastered).length;
        return <CollectionRow key={deck.id} title={deck.name} subtitle={deck.course} count={cards.length}
          due={cards.filter(card => card.nextReviewAt <= Date.now() && !card.mastered && !card.suspended).length} progress={cards.length ? mastered / cards.length : 0}
          onManage={() => onOpen(deck.id)} onLearn={() => onStudy(deck.id)} onQuiz={() => onQuiz(deck.id)} onEdit={() => setEditingDeck(deck)} onShare={()=>window.dispatchEvent(new CustomEvent("vocab-share-folder",{detail:deck.id}))}
          onDelete={() => { if (confirm(`刪除「${deck.name}」與裡面的字卡？`)) onDelete(deck.id); }} onMove={offset => shiftDeck(deck.id, offset)} />;
      })}</div>}
    <button className="fab" onClick={()=>setAdding(!adding)} aria-label="新增資料夾"><Icon icon={MdAdd} /></button>
    {adding&&<div className="folder-add-menu"><button className="secondary" onClick={()=>{setAdding(false);onAdd();}}>建立資料夾</button><button className="secondary" onClick={()=>{setAdding(false);window.dispatchEvent(new Event("vocab-import-folders"));}}>匯入分享檔案</button></div>}
    {editingDeck && <EditDeckDialog deck={editingDeck} courses={Array.from(new Set(state.decks.map(item => item.course)))} onClose={() => setEditingDeck(null)} onSave={deck => { onUpdate(deck); setEditingDeck(null); }} />}
    {renamingCourse && <div className="nested-dialog-backdrop"><section className="nested-dialog"><header><h3>重新命名課程</h3><button className="icon-button" aria-label="關閉" onClick={() => setRenamingCourse(null)}><MdClose size={22} /></button></header><div className="form"><label><span>課程名稱</span><input autoFocus value={courseName} onChange={event => setCourseName(event.target.value)} /></label><div className="dialog-form-actions"><button className="secondary" onClick={() => setRenamingCourse(null)}>取消</button><button className="primary" disabled={!courseName.trim() || courseName.trim() === renamingCourse || state.decks.some(deck => deck.course === courseName.trim())} onClick={() => { const next=courseName.trim(); onRenameCourse(renamingCourse,next); setCourse(next); setRenamingCourse(null); }}>儲存</button></div></div></section></div>}
  </>;
}

function EditDeckDialog({ deck, courses, onClose, onSave }: { deck: Deck; courses: string[]; onClose: () => void; onSave: (deck: Deck) => void }) {
  const [draft, setDraft] = useState(deck); const colors = ["#426B63","#5E7180","#8A6657","#55749A","#6F7D52","#A7793D"];
  return <div className="nested-dialog-backdrop"><section className="nested-dialog"><header><h3>編輯資料夾</h3><button className="icon-button" aria-label="關閉" onClick={onClose}><MdClose size={22} /></button></header><div className="form folder-form">
    <label><span>資料夾名稱 *</span><input value={draft.name} onChange={event => setDraft(current => ({ ...current, name:event.target.value }))} /></label>
    <label><span>課程</span><select value={draft.course} onChange={event => setDraft(current => ({ ...current, course:event.target.value }))}>{Array.from(new Set([draft.course,...courses])).map(value => <option key={value} value={value}>{value}</option>)}</select></label>
    <label><span>說明（選填）</span><input value={draft.description || ""} onChange={event => setDraft(current => ({ ...current, description:event.target.value }))} /></label>
    <fieldset><legend>顏色</legend><div className="folder-colors">{colors.map(value => <button type="button" key={value} aria-label={`選擇顏色 ${value}`} className={draft.color === value ? "selected" : ""} style={{ background:value }} onClick={() => setDraft(current => ({ ...current, color:value }))} />)}</div></fieldset>
    <div className="dialog-form-actions"><button className="secondary" onClick={onClose}>取消</button><button className="primary" disabled={!draft.name.trim() || !draft.course.trim()} onClick={() => onSave({ ...draft, name:draft.name.trim(), course:draft.course.trim(), description:draft.description?.trim() })}>儲存</button></div>
  </div></section></div>;
}

function HubView({ kind, state, onStudy, onQuiz, onManage }: { kind: "study" | "quiz"; state: VocabState; onStudy: (id: string) => void; onQuiz: (id: string) => void; onManage: (id: string) => void }) {
  const [course, setCourse] = useState("全部");
  const courses = ["全部", ...Array.from(new Set(state.decks.map(deck => deck.course)))];
  const decks = [...state.decks].filter(deck => course === "全部" || deck.course === course).sort((a,b) => a.order-b.order);
  return <>
    {state.decks.length > 0 && <div className="modern-filter"><p>選擇課程</p><div className="chips">{courses.map(value => <button key={value} className={course === value ? "selected" : ""} onClick={() => setCourse(value)}>{value === "全部" ? `全部資料夾 (${state.decks.length})` : `${value} (${state.decks.filter(deck => deck.course === value).length})`}</button>)}</div>
    <button className="primary" disabled={!state.cards.some(card => course === "全部" || state.decks.find(deck => deck.id === card.deckId)?.course === course)} onClick={() => (kind === "study" ? onStudy : onQuiz)(course === "全部" ? "__all__" : `__course__${course}`)}><MdStyle size={24} />{kind === "study" ? "複習全部" : "測驗全部"} · {course === "全部" ? state.cards.length : state.cards.filter(card => state.decks.find(deck => deck.id === card.deckId)?.course === course).length}</button></div>}
    {decks.length === 0 ? <Empty title="還沒有資料夾" text="先建立資料夾，再開始學習。" /> : <div className="modern-stack">{decks.map(deck => {
      const cards = state.cards.filter(card => card.deckId === deck.id);
      const mastered = cards.filter(card => card.mastered).length;
      return <CollectionRow key={deck.id} title={deck.name} subtitle={deck.course} count={cards.length} mode={kind === "study" ? "learn" : "quiz"}
        due={kind === "study" ? cards.filter(card => card.nextReviewAt <= Date.now() && !card.mastered && !card.suspended).length : undefined}
        progress={kind === "study" ? (cards.length ? mastered / cards.length : 0) : undefined} onManage={() => onManage(deck.id)} onLearn={() => onStudy(deck.id)} onQuiz={() => onQuiz(deck.id)} />;
    })}</div>}
  </>;
}

function Empty({ title, text, action, onAction }: { title: string; text: string; action?: string; onAction?: () => void }) {
  return <div className="empty"><Icon icon={MdFolder} size={38} /><h3>{title}</h3><p>{text}</p>{action && onAction && <button className="primary" onClick={onAction}>{action}</button>}</div>;
}

function calculateStreak(state: VocabState) {
  return streakStats(state).current;
}

function SheetFrame({ title, subtitle, onClose, children, wide = false, action, className = "" }: { className?: string; title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; wide?: boolean; action?: React.ReactNode }) {
  return <div className={`sheet-backdrop ${wide ? "page-backdrop" : ""}`} onMouseDown={event => !wide && event.target === event.currentTarget && onClose()}>
    <section className={`sheet ${wide ? "sheet-wide" : ""} ${className}`} role={wide ? "main" : "dialog"} aria-modal={wide ? undefined : true}>
      {!wide && <div className="android-dialog-handle" />}
      <header>{wide && <button className="icon-button" aria-label="返回" onClick={onClose}><MdArrowBack size={24} /></button>}<div className="sheet-title"><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</header>
      <div className="sheet-body">{children}</div>
    </section>
  </div>;
}

function DeckSheet({ state, onClose, onSave }: { state: VocabState; onClose: () => void; onSave: (name: string, course: string, description: string, color: string) => void }) {
  const [name, setName] = useState(""); const [course, setCourse] = useState(state.decks[0]?.course || ""); const [newCourse, setNewCourse] = useState(""); const [addingCourse, setAddingCourse] = useState(state.decks.length === 0); const [description, setDescription] = useState(""); const [color, setColor] = useState("#426B63");
  const courses = Array.from(new Set(state.decks.map(deck => deck.course)));
  return <SheetFrame title="新增資料夾" subtitle="把同一主題的單字整理在一起" onClose={onClose}>
    <form className="form folder-form" onSubmit={event => { event.preventDefault(); const finalCourse = addingCourse ? newCourse.trim() : course.trim(); if (name.trim() && finalCourse) onSave(name.trim(), finalCourse, description.trim(), color); }}>
      <fieldset><legend>課程</legend>{!addingCourse ? <label className="android-outlined-field"><span>選擇課程</span><select value={course} onChange={event => { if (event.target.value === "__new__") setAddingCourse(true); else setCourse(event.target.value); }}>{courses.map(value => <option key={value} value={value}>{value}</option>)}<option value="__new__">新增課程…</option></select></label> : <><label className="android-outlined-field"><span>課程名稱</span><input autoFocus value={newCourse} onChange={event => setNewCourse(event.target.value)} /></label>{!!courses.length && <button type="button" className="secondary wide" onClick={() => setAddingCourse(false)}>改選現有課程</button>}</>}</fieldset>
      <fieldset><legend>資料夾</legend><label className="android-outlined-field"><span>名稱 *</span><input autoFocus={!addingCourse} value={name} onChange={event => setName(event.target.value)} /></label></fieldset>
      <label className="android-outlined-field"><span>說明（選填）</span><input value={description} onChange={event => setDescription(event.target.value)} /></label>
      <fieldset><legend>顏色</legend><div className="folder-colors">{["#426B63","#5E7180","#8A6657","#55749A","#6F7D52","#A7793D"].map(value => <button type="button" key={value} aria-label={`選擇顏色 ${value}`} className={color === value ? "selected" : ""} style={{ background:value }} onClick={() => setColor(value)} />)}</div></fieldset>
      <div className="dialog-form-actions"><button type="button" className="secondary" onClick={onClose}>取消</button><button className="primary" disabled={!name.trim() || !(addingCourse ? newCourse.trim() : course.trim())}>建立資料夾</button></div>
    </form>
  </SheetFrame>;
}

function CardSheet({ state, deck, cards, initialCardId, onCommit, onClose, onSave, onDeckChange }: { state: VocabState; deck?: Deck; cards: Card[]; initialCardId?: string; onCommit: (rows: EditorRow[], originalIds: string[]) => boolean; onClose: () => void; onSave: (draft: CardDraft) => boolean; onDeckChange: (id: string) => void }) {
  type DraftRow = EditorRow & { aiBusy:boolean };
  const editing = !!initialCardId;
  const existing = editing ? cards.filter(card => card.deckId === deck?.id).sort((a,b) => a.order-b.order) : [];
  const [originalIds, setOriginalIds] = useState(() => existing.map(card => card.id));
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const focused = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!editing) return; const timer = setTimeout(() => focused.current?.scrollIntoView({ block:"start", behavior:"instant" }), 100); return () => clearTimeout(timer); }, [editing, initialCardId]);
  const makeRow = (): DraftRow => ({ ...blankCard, rowId:makeId(), aiBusy:false });
  const [drafts, setDrafts] = useState<DraftRow[]>(editing ? existing.map(card => ({ ...card, cardId:card.id, rowId:card.id, aiBusy:false })) : [makeRow()]); const [aiStatus, setAiStatus] = useState("");
  const draftKey=`vocab-editor-draft-v1-${deck?.id??"none"}-${editing?"edit":"add"}`;
  const baseline=JSON.stringify(existing.map(({id,word,definition,phonetic,partOfSpeech,exampleSentence,exampleTranslation})=>({id,word,definition,phonetic,partOfSpeech,exampleSentence,exampleTranslation})));
  const [recovery,setRecovery]=useState<{rows:DraftRow[];originalIds:string[];baseline:string}|null>(()=>{try{const raw=localStorage.getItem(draftKey);if(!raw)return null;const saved=JSON.parse(raw);return Array.isArray(saved.rows)&&Array.isArray(saved.originalIds)&&saved.rows.length<=10000?saved:null;}catch{return null;}});
  const latestDraft=useRef({drafts,originalIds,baseline});
  useEffect(()=>{latestDraft.current={drafts,originalIds,baseline};},[drafts,originalIds,baseline]);
  useEffect(()=>{
    if(recovery)return;
    const save=()=>{const value=latestDraft.current;try{const projected=value.drafts.filter(row=>row.word.trim()||row.definition.trim()).map(row=>({id:row.cardId??row.rowId,word:row.word,definition:row.definition,phonetic:row.phonetic,partOfSpeech:row.partOfSpeech,exampleSentence:row.exampleSentence,exampleTranslation:row.exampleTranslation}));const pristine=editing&&JSON.stringify(projected)===value.baseline;if(!pristine&&value.drafts.some(row=>[row.word,row.definition,row.phonetic,row.partOfSpeech,row.exampleSentence,row.exampleTranslation,row.notes].some(v=>v?.trim())))localStorage.setItem(draftKey,JSON.stringify({rows:value.drafts.map(row=>({...row,aiBusy:false})),originalIds:value.originalIds,baseline:value.baseline}));else localStorage.removeItem(draftKey);}catch{setAiStatus("草稿儲存失敗，請先儲存單字或下載備份再離開");}};
    const timer=setTimeout(save,350);window.addEventListener("pagehide",save);return()=>{clearTimeout(timer);window.removeEventListener("pagehide",save);save();};
  },[drafts,originalIds,draftKey,recovery,editing]);
  const update = (rowId:string, key:keyof CardDraft, value:string) => setDrafts(current => current.map(row => row.rowId === rowId ? { ...row, [key]:value } : row));
  const insertAt = (index:number) => setDrafts(current => [...current.slice(0,index), makeRow(), ...current.slice(index)]);
  const removeRow = (rowId:string) => setDrafts(current => current.length === 1 ? [makeRow()] : current.filter(row => row.rowId !== rowId));
  const commitEditing = () => { if (drafts.some(row => row.aiBusy)) { setAiStatus("請等待 AI 補齊完成後再儲存"); return false; } if (!onCommit(drafts, originalIds)) { setAiStatus("未儲存：請確認所有单字及定義完整，且沒有重複單字。"); return false; } const kept=drafts.filter(row => row.word.trim() && row.definition.trim()).map(row => ({...row,cardId:row.cardId ?? row.rowId})); setDrafts(kept.length ? kept : [makeRow()]); setOriginalIds(kept.map(row => row.cardId)); setAiStatus("所有變更已儲存，學習進度與收藏已保留"); return true; };
  const completeAi = async (rowId?:string) => {
    if (!state.settings.aiEnabled) { setAiStatus("AI 功能目前已關閉"); return; }
    if (!state.settings.aiApiKey && !state.settings.aiProfiles?.length) { setAiStatus("請先到設定加入 AI API Key"); return; }
    const targets = drafts.filter(row => (!rowId || row.rowId === rowId) && row.word.trim() && (!row.phonetic || !row.partOfSpeech || !row.definition || !row.exampleSentence || !row.exampleTranslation));
    if (!targets.length) { setAiStatus("沒有需要 AI 補齊的卡片"); return; }
    const ids = new Set(targets.map(row => row.rowId)); setDrafts(current => current.map(row => ids.has(row.rowId) ? { ...row, aiBusy:true } : row)); setAiStatus(`AI 正在補齊 ${targets.length} 張卡片…`);
    // Send a batch in sequence instead of flooding the provider with every card.
    const results: Array<readonly [string, Partial<CardDraft> | Error]> = [];
    for (const [index,row] of targets.entries()) { setAiStatus(`AI 正在補齊第 ${index+1} / ${targets.length} 張；服務忙碌時會自動重試…`);try {results.push([row.rowId,await fetchWordDetails(state,row.word,row)]);}catch(error){results.push([row.rowId,error instanceof Error ? error : new Error("AI 連線失敗")]);} }
    const byId = new Map<string, Partial<CardDraft> | Error>(results); const completed=results.filter(([,result])=>!(result instanceof Error)).length; const failed=results.length-completed;
    setDrafts(current => current.map(row => { const result=byId.get(row.rowId); if (!result) return row; if (result instanceof Error) { return { ...row,aiBusy:false }; } return { ...mergeCardCompletion(row,result), aiBusy:false }; }));
    const failure=results.find(([,result])=>result instanceof Error)?.[1];
    setAiStatus(completed ? `AI 已補齊 ${completed} 張；原有內容均未覆蓋${failed ? `，${failed} 張失敗：${failure instanceof Error ? failure.message : "請重試"}` : ""}` : `AI 補齊失敗：${failure instanceof Error ? failure.message : "請檢查 API、模型與額度"}`);
  };
  const submit = (event:FormEvent) => { event.preventDefault(); if (editing) { commitEditing(); return; } const seen=new Set<string>(); const ready=drafts.filter(row => { const key=normalize(row.word); if (!key || !row.definition.trim() || seen.has(key)) return false; seen.add(key); return true; }); const saved=ready.filter(row => onSave({ word:row.word.trim(), phonetic:row.phonetic, partOfSpeech:row.partOfSpeech, definition:row.definition.trim(), exampleSentence:row.exampleSentence, exampleTranslation:row.exampleTranslation, notes:row.notes })).length; if (saved) { setDrafts([makeRow()]); setAiStatus(`已依畫面順序儲存 ${saved} 張單字卡`); } };
  const anyBusy=drafts.some(row => row.aiBusy); const canSave=editing || drafts.some(row => row.word.trim() && row.definition.trim());
  return <SheetFrame className="add-card-sheet" title={editing ? "編輯單字卡" : "新增單字卡"} onClose={() => { if (!editing || commitEditing()) onClose(); }} wide action={<button className="topbar-ai-action" disabled={!drafts.some(row => row.word.trim()) || anyBusy} onClick={() => completeAi()}>{anyBusy ? <span className="spinner" /> : <MdAutoAwesome size={19} />}<span>AI 一鍵補齊</span></button>}>
    <form className="form card-form" onSubmit={submit}>
      {recovery&&<div className="draft-recovery"><p>找到上次未完成的編輯草稿。{editing&&recovery.baseline!==baseline?"原資料已更新，請先複製草稿內容，避免覆蓋新內容。":"可恢復後繼續編輯。"}</p><button type="button" className="secondary" disabled={editing&&recovery.baseline!==baseline} onClick={()=>{setDrafts(recovery.rows.map(row=>({...row,aiBusy:false})));setOriginalIds(recovery.originalIds);setRecovery(null);}}>恢復草稿</button><button type="button" className="secondary" onClick={()=>{void navigator.clipboard.writeText(JSON.stringify(recovery.rows,null,2));}}>複製草稿</button><button type="button" className="secondary" onClick={()=>{localStorage.removeItem(draftKey);setRecovery(null);}}>捨棄草稿</button></div>}
      <section className="save-location-card"><div><strong>儲存位置</strong><small>{deck ? `會加入「${deck.name}」最後方` : "請選擇資料夾"}</small></div><DeckPicker state={state} value={deck?.id ?? ""} onChange={id => { if (!editing || commitEditing()) onDeckChange(id); }} /></section>
      <button type="button" className="insert-card-divider" onClick={() => insertAt(0)}><MdAdd size={17} />新增到最前面</button>
      {drafts.map((draft,index) => <div className={`manual-card-group ${draft.cardId === initialCardId ? "editor-target" : ""}`} data-card-id={draft.cardId} ref={draft.cardId === initialCardId ? focused : undefined} key={draft.rowId}><article className="manual-card-editor"><div className="manual-card-head"><strong>單字卡 #{index+1}</strong><button type="button" className="icon-button card-ai-icon" aria-label="AI 補齊" disabled={!draft.word.trim() || draft.aiBusy} onClick={() => completeAi(draft.rowId)}>{draft.aiBusy ? <span className="spinner" /> : <MdAutoAwesome size={24} />}</button><button type="button" className="icon-button delete-draft-icon" aria-label="刪除這張輸入卡" onClick={() => draft.cardId ? setPendingDelete(draft.rowId) : removeRow(draft.rowId)}><MdDelete size={24} /></button></div><label><span>英文單字</span><input autoFocus={index===0 && !editing} value={draft.word} onChange={event => update(draft.rowId,"word",event.target.value)} autoCapitalize="none" /></label>
      <div className="form-grid compact-fields"><label><span>詞性</span><input value={draft.partOfSpeech} onChange={event => update(draft.rowId,"partOfSpeech",event.target.value)} /></label><label><span>音標</span><input value={draft.phonetic} onChange={event => update(draft.rowId,"phonetic",event.target.value)} /></label></div>
      <label><span>繁體中文定義</span><textarea rows={2} value={draft.definition} onChange={event => update(draft.rowId,"definition",event.target.value)} /></label><label><span>英文例句</span><textarea rows={2} value={draft.exampleSentence} onChange={event => update(draft.rowId,"exampleSentence",event.target.value)} /></label>
      <label><span>中文翻譯</span><textarea rows={2} value={draft.exampleTranslation} onChange={event => update(draft.rowId,"exampleTranslation",event.target.value)} /></label></article><button type="button" className="insert-card-divider" onClick={() => insertAt(index+1)}><MdAdd size={17} />在此新增</button></div>)}
      {aiStatus && <p className="hint ai-fill-status">{aiStatus}</p>}
      <div className="card-save-footer"><button className="primary wide" disabled={!canSave || anyBusy}>{editing ? "儲存全部變更" : "儲存全部並繼續新增"}</button></div><button type="button" className="fab add-card-fab" aria-label="新增單字" onClick={() => insertAt(drafts.length)}><MdAdd size={24} /></button>
    </form>
    {pendingDelete && <div className="nested-dialog-backdrop"><section className="nested-dialog" role="dialog" aria-modal="true" aria-labelledby="editor-delete-title"><h3 id="editor-delete-title">從編輯清單刪除單字卡？</h3><p>按下儲存全部變更後才會真正刪除，其他單字的學習進度不會受影響。</p><div className="dialog-actions"><button className="secondary" onClick={() => setPendingDelete(null)}>取消</button><button className="danger-button" onClick={() => { removeRow(pendingDelete); setPendingDelete(null); }}>從清單移除</button></div></section></div>}
  </SheetFrame>;
}

function DeckPicker({ state, value, onChange }: { state: VocabState; value: string; onChange: (id: string) => void }) {
  const courses = Array.from(new Set(state.decks.map(deck => deck.course)));
  const course = state.decks.find(deck => deck.id === value)?.course ?? courses[0] ?? "";
  return <div className="android-destination"><label><span>選擇課程</span><select value={course} onChange={event => { const deck = state.decks.find(item => item.course === event.target.value); if (deck) onChange(deck.id); }}>{courses.map(item => <option key={item} value={item}>{item}</option>)}</select></label><label><span>選擇資料夾</span><select value={value} onChange={event => onChange(event.target.value)}>{state.decks.filter(deck => deck.course === course).map(deck => <option key={deck.id} value={deck.id}>{deck.name}</option>)}</select></label></div>;
}

function StudySheet({ state, initialDeckId, onClose, onRate, onUndo, onToggleFavorite, autoSpeak, speechRate, onQuiz }: { state: VocabState; initialDeckId: string; onClose: () => void; onRate: (id: string, remembered: boolean) => void; onUndo:(original:Card)=>void; onToggleFavorite:(id:string)=>void; autoSpeak: boolean; speechRate: number; onQuiz: (deckId: string) => void }) {
  const first = initialDeckId || state.decks.find(deck => state.cards.some(card => card.deckId === deck.id))?.id || state.decks[0]?.id || "";
  const [deckId, setDeckId] = useState(first); const [mode, setMode] = useState<"choose" | "study" | "done">("choose");
  const [queue, setQueue] = useState<Card[]>([]); const [index, setIndex] = useState(0); const [flipped, setFlipped] = useState(false); const [autoPlaying,setAutoPlaying]=useState(false); const [unfamiliar,setUnfamiliar]=useState<Set<string>>(new Set()); const [history,setHistory]=useState<Array<{card:Card;index:number;wasUnfamiliar:boolean}>>([]);
  const begin = (random:boolean) => {
    const all = scopedCards(state, deckId).filter(card => !card.suspended).sort((a, b) => a.order - b.order);
    const sessionKey=`vocab-study-session-${deckId}`; let saved:{remaining?:string[];unfamiliar?:string[]}|null=null; try{saved=JSON.parse(localStorage.getItem(sessionKey)||"null")}catch{}
    const resumed=(saved?.remaining||[]).map(id=>all.find(card=>card.id===id)).filter(Boolean) as Card[];
    if(resumed.length){setQueue(resumed);setIndex(0);setFlipped(false);setUnfamiliar(new Set(saved?.unfamiliar||[]));setHistory([]);setMode("study");return;}
    const remaining = all.filter(card => !card.mastered);
    const pool = remaining.length ? remaining : all;
    const next = random ? [...pool].sort(() => Math.random() - .5) : pool;
    setQueue(next); setIndex(0); setFlipped(false); setUnfamiliar(new Set()); setHistory([]); setMode(next.length ? "study" : "choose");
  };
  const card = queue[index];
  const advanceAutoplay = useEffectEvent(() => { if (!flipped) setFlipped(true); else rate(true); });
  useEffect(() => {
    if (mode !== "study" || !card || (!autoSpeak && !autoPlaying)) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      for (const part of cardSpeechParts(card, state.settings, flipped)) {
        if (cancelled || !await speakText(part.text, speechRate, part.language)) return false;
      }
      return !cancelled;
    })().then(finished => {
      if (cancelled || !autoPlaying) return;
      if (!finished) { setAutoPlaying(false); return; }
      timer = setTimeout(() => { if (!cancelled) advanceAutoplay(); }, 800);
    });
    return () => { cancelled = true; clearTimeout(timer); cancelSpeech(); };
  }, [mode, card, flipped, autoSpeak, autoPlaying, speechRate, state.settings]);
  function rate(remembered: boolean) {
    if (!card) return; const nextUnfamiliar=new Set(unfamiliar); if(remembered)nextUnfamiliar.delete(card.id);else nextUnfamiliar.add(card.id); const remainingIds=queue.slice(index+1).map(item=>item.id); const nextIds=remainingIds.length?remainingIds:[...nextUnfamiliar]; if(nextIds.length)localStorage.setItem(`vocab-study-session-${deckId}`,JSON.stringify({remaining:nextIds,unfamiliar:[...nextUnfamiliar]}));else localStorage.removeItem(`vocab-study-session-${deckId}`); setHistory(current => [...current,{card:state.cards.find(item=>item.id===card.id) ?? card,index,wasUnfamiliar:unfamiliar.has(card.id)}]); onRate(card.id, remembered); setUnfamiliar(nextUnfamiliar);
    if (index + 1 >= queue.length) { setAutoPlaying(false); setMode("done"); } else { setIndex(value => value + 1); setFlipped(false); }
  }
  const undo=()=>{ const last=history.at(-1); if(!last)return; onUndo(last.card); setHistory(current=>current.slice(0,-1)); setIndex(last.index); setMode("study"); setFlipped(false); const next=new Set(unfamiliar);if(last.wasUnfamiliar)next.add(last.card.id);else next.delete(last.card.id);setUnfamiliar(next);localStorage.setItem(`vocab-study-session-${deckId}`,JSON.stringify({remaining:queue.slice(last.index).map(item=>item.id),unfamiliar:[...next]})); };
  const continueUnfamiliar=()=>{const all=scopedCards(state,deckId);const next=[...unfamiliar].map(id=>all.find(item=>item.id===id)).filter(Boolean) as Card[];setQueue(next);setIndex(0);setFlipped(false);setHistory([]);setUnfamiliar(new Set());localStorage.setItem(`vocab-study-session-${deckId}`,JSON.stringify({remaining:next.map(item=>item.id),unfamiliar:[]}));setMode(next.length?"study":"done");};
  const title=state.decks.find(item=>item.id===deckId)?.name || (deckId==="__all__"?"全部資料夾":"課程學習");
  return <SheetFrame title={mode === "choose" ? "開始學習" : mode === "done" ? "本輪完成" : `學習 · ${queue.length-index} 張`} subtitle={mode === "study" ? title : undefined} onClose={() => { window.speechSynthesis?.cancel(); onClose(); }} wide>
    {mode === "choose" && <div className="study-order-backdrop" onClick={onClose}><section className="study-order-dialog" onClick={event=>event.stopPropagation()}><h3>選擇卡片順序</h3><p>未完成的學習進度仍會從上次離開的位置繼續。</p><DeckPicker state={state} value={deckId} onChange={setDeckId}/><div><button className="secondary" disabled={!scopedCards(state,deckId).length} onClick={()=>begin(false)}>依照順序</button><button className="primary" disabled={!scopedCards(state,deckId).length} onClick={()=>begin(true)}>隨機排列</button></div></section></div>}
    {mode === "study" && card && <div className="study-stage android-study"><div className="study-progress"><div><span>進度</span><strong>{index} / {queue.length} · 不熟 {unfamiliar.size}</strong></div><div className="progress-track"><span style={{width:`${queue.length?index/queue.length*100:0}%`}}/></div></div>
      <FlipCard key={card.id} card={state.cards.find(item => item.id === card.id) ?? card} flipped={flipped} onFlip={() => { cancelSpeech(); setFlipped(value => !value); }} onRate={rate} onFavorite={() => onToggleFavorite(card.id)} onSpeak={text => speak(text, speechRate)} />
      <div className="study-icon-actions"><button className="icon-button" disabled={!history.length} onClick={undo} aria-label="返回上一步"><MdUndo size={25}/></button><button className="icon-button" onClick={()=>setAutoPlaying(value=>!value)} aria-label={autoPlaying?"暫停自動播放":"開始自動播放"}>{autoPlaying?<MdPause size={26}/>:<MdPlayArrow size={26}/>}</button></div></div>}
    {mode === "done" && <div className="completion study-completion"><span><MdCheckCircle size={38}/></span><h2>{unfamiliar.size?"本輪完成":"全部記熟了"}</h2><p>{unfamiliar.size?`還有 ${unfamiliar.size} 張不熟，可以接著練習。`:"可以前往測驗，或重新學習全部卡片。"}</p>{unfamiliar.size?<button className="primary wide" onClick={continueUnfamiliar}>繼續複習（{unfamiliar.size}）</button>:<><button className="primary wide" onClick={()=>onQuiz(deckId)}>前往測驗</button><button className="secondary wide" onClick={()=>begin(false)}>重新學習</button></>}{history.length > 0 && <button className="secondary wide" onClick={undo}>返回上一步</button>}<button className="secondary wide" onClick={onClose}>返回學習</button></div>}
  </SheetFrame>;
}


function AiSheet({ state, onClose, onSettings, onApply }: { state: VocabState; onClose: () => void; onSettings: () => void; onApply: (action: AiAction) => string }) {
  const [messages,setMessages]=useState<ChatMessage[]>([]),[input,setInput]=useState(""),[busy,setBusy]=useState(false),[scope,setScope]=useState("all"),[pending,setPending]=useState<AiAction|null>(null),[workingText,setWorkingText]=useState(""),[streamed,setStreamed]=useState("");
  const [article,setArticle]=useState<ArticleDraft|null>(null),abortRef=useRef<AbortController|null>(null),messageList=useRef<HTMLDivElement>(null);
  useEffect(()=>{try{const saved=localStorage.getItem("vocab-article-draft-v1");if(saved){const draft=JSON.parse(saved);if(Array.isArray(draft.words)&&typeof draft.text==="string")setArticle(draft);}}catch{}},[]);
  useEffect(()=>{messageList.current?.scrollTo({top:messageList.current.scrollHeight,behavior:"smooth"});},[messages,busy,pending,streamed,article]);
  useEffect(()=>()=>abortRef.current?.abort(),[]);
  useEffect(()=>{const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue="";};if(busy){document.documentElement.dataset.aiBusy="true";window.addEventListener("beforeunload",warn);}return()=>{delete document.documentElement.dataset.aiBusy;window.removeEventListener("beforeunload",warn);};},[busy]);
  const leave=()=>{if(busy&&!confirm("AI 作業仍在進行，離開會取消。已完成文章章節保留，要離開嗎？"))return;abortRef.current?.abort();onClose();};
  const saveArticle=(draft:ArticleDraft)=>{setArticle(draft);setWorkingText(`文章涵蓋 ${draft.words.length-draft.missing.length} / ${draft.words.length} 個單字`);try{localStorage.setItem("vocab-article-draft-v1",JSON.stringify(draft));}catch{setWorkingText("文章草稿儲存失敗，請先複製內容再離開");}};
  const send=async(suggestion?:string,resume=false)=>{
    const text=(suggestion??input).trim();if(!text||busy)return;if(!state.settings.aiApiKey&&!state.settings.aiProfiles?.length){onSettings();return;}
    const next=[...messages,{role:"user",text} as ChatMessage];setMessages(next);setInput("");setBusy(true);setPending(null);setStreamed("");setWorkingText("正在連線與準備回答…");
    const controller=new AbortController();abortRef.current=controller;
    try {
      if(resume || /(?:寫|生成|建立|產生|撰寫).*(?:文章|故事|閱讀)|(?:文章|故事).*(?:生成|撰寫)/.test(text)){
        const explicit=state.decks.filter(d=>text.includes(d.name));const decks=explicit.length?explicit:state.decks.filter(d=>scope==="all"||d.id===scope);
        const words=resume&&article?article.words:state.cards.filter(c=>decks.some(d=>d.id===c.deckId)).map(c=>c.word);
        if(!words.length)throw Error("所選資料夾沒有單字，請先選擇有內容的資料夾");
        await generateCoveredArticle(state.settings,words,text,controller.signal,saveArticle,resume?article?.text??"":"");
      }else{
        const response=await askAi(state,next.slice(-8),scope,controller.signal,raw=>setStreamed(partialReply(raw)));
        if(controller.signal.aborted)return;setMessages(current=>[...current,{role:"assistant",text:response.reply}]);setPending(response.action?{...response.action,__scope:scope}:null);
      }
    }catch(error){setMessages(current=>[...current,{role:"assistant",text:controller.signal.aborted?"已停止，未執行資料修改；已完成文章章節保留。":`無法完成：${(error as Error).message}`}]);}
    finally{if(abortRef.current===controller){setBusy(false);setStreamed("");abortRef.current=null;}}
  };
  return <SheetFrame className="ai-sheet" title="Vocab AI" subtitle={scope==="all"?"可編輯全部資料夾":state.decks.find(d=>d.id===scope)?.name} action={<button className="icon-button" aria-label="新對話" disabled={busy} onClick={()=>{setMessages([]);setPending(null);setInput("");}}>＋</button>} onClose={leave} wide>
    <div className="chat"><div className="chat-messages" ref={messageList} aria-live="polite">
      {!messages.length&&<div className="assistant-welcome"><h2>一起整理與練習</h2><p>所有資料修改都會先讓你確認。文章會檢查所選資料夾的全部單字。</p><button className="secondary" onClick={onSettings}>AI 設定</button>{["依照字母排序這個資料夾","找出容易混淆的單字","根據這個資料夾寫一篇文章","製作五題互動測驗"].map(text=><button key={text} className="secondary" disabled={busy} onClick={()=>void send(text)}>{text}</button>)}</div>}
      {messages.map((message,index)=><div key={index} className={`message ${message.role}`}><p>{message.text}</p>{message.role==="assistant"&&<button onClick={()=>void navigator.clipboard.writeText(message.text)}>複製</button>}</div>)}
      {article&&<article className="article-draft"><h3>{article.done?"文章已完成":"文章草稿／尚未完成"} · {article.words.length-article.missing.length} / {article.words.length} 字</h3><p className="article-text">{(()=>{let cursor=0;const nodes:React.ReactNode[]=[];for(const span of articleHighlights(article.text,article.words)){nodes.push(article.text.slice(cursor,span.start),<mark key={span.start} title={state.cards.find(c=>c.word===span.word)?.definition??span.word}>{article.text.slice(span.start,span.end)}</mark>);cursor=span.end;}nodes.push(article.text.slice(cursor));return nodes;})()}</p><details><summary>目標單字與釋義</summary>{article.words.map(word=><p key={word}>{missingArticleWords(article.text,[word]).length?"○":"✓"} <mark>{word}</mark> — {state.cards.find(c=>c.word===word)?.definition??""}</p>)}</details>{!!article.missing.length&&<p>尚缺：{article.missing.join("、")}</p>}<button className="secondary" onClick={()=>void navigator.clipboard.writeText(article.text)}>複製文章</button>{!article.done&&<button className="primary" disabled={busy} onClick={()=>void send("繼續補齊文章所有遺漏單字",true)}>繼續補齊</button>}</article>}
      {busy&&<div className="message assistant working"><span className="spinner"/><p>{streamed||workingText}</p><small>串流文字僅為草稿，完整驗證後才提供修改確認。</small></div>}
      {pending&&<div className="assistant-action-card"><strong>等待你的確認</strong><p>{describeAiAction(pending,state)}</p><button className="secondary" onClick={()=>setPending(null)}>取消</button><button className="primary" onClick={()=>{const result=onApply(pending);setMessages(current=>[...current,{role:"assistant",text:result}]);setPending(null);}}>確認執行</button></div>}
    </div><div className="assistant-scope"><span>可編輯範圍／文章單字</span><select value={scope} disabled={busy} onChange={e=>setScope(e.target.value)}><option value="all">全部資料夾</option>{state.decks.map(deck=><option key={deck.id} value={deck.id}>{deck.name}</option>)}</select></div><div className="composer"><textarea maxLength={4000} aria-label="傳送訊息給 Vocab AI" value={input} onChange={e=>setInput(e.target.value)} placeholder="告訴 AI 你想做什麼…" onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void send();}}}/><button className="send" aria-label={busy?"停止":"送出"} onClick={()=>busy?abortRef.current?.abort():void send()}>{busy?<MdStop size={24}/>:<MdSend size={24}/>}</button></div></div>
  </SheetFrame>;
}

function describeAiAction(action: AiAction, state: VocabState) {
  if (action.type === "sortAlphabetically") return "依英文字母重新排列指定資料夾；不會刪除或改寫卡片內容。";
  if (action.type === "createDeck") return `建立資料夾「${String(action.name || "新資料夾")}」${Array.isArray(action.cards) ? `，並加入 ${action.cards.length} 張卡片` : ""}。`;
  if (action.type === "renameDeck") return `重新命名「${state.decks.find(deck => deck.id === action.deckId)?.name || "指定資料夾"}」。`;
  if (action.type === "updateCards") return `更新 ${Array.isArray(action.updates) ? action.updates.length : 0} 張單字卡的欄位。`;
  if (action.type === "moveCards") return `移動 ${Array.isArray(action.words) ? action.words.length : 0} 個單字到指定資料夾。`;
  return "執行 AI 建議的資料變更。";
}

function parseAssistantResponse(raw: string): { reply: string; action: AiAction | null } {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try { const parsed = JSON.parse(cleaned) as { reply?: string; action?: AiAction | null }; return { reply: parsed.reply || "已完成分析。", action: parsed.action ?? null }; }
  catch { return { reply: raw, action: null }; }
}

async function askAi(state: VocabState, messages: ChatMessage[], scope: string, signal: AbortSignal, onText?:(raw:string)=>void) {
  const needsData=/資料夾|單字|詞性|排序|卡片|整理|修改|補齊|移動|測驗|題目|folder|vocab/i.test(messages.at(-1)?.text??"");
  const readableContext = state.decks.map(deck => ({ id: deck.id, name: deck.name, course: deck.course, cardCount: state.cards.filter(card => card.deckId === deck.id).length, cards: (needsData&&(scope === "all" || scope === deck.id) ? state.cards.filter(card => card.deckId === deck.id).slice(0, 250) : []).map(({ id, word, partOfSpeech, definition }) => ({ id, word, partOfSpeech, definition })), contextLimited:state.cards.filter(card=>card.deckId===deck.id).length>250 }));
  const editableIds = scope === "all" ? state.decks.map(deck => deck.id) : [scope];
  const system = `你是 Vocab 的英文學習與資料管理助手。真實資料：${JSON.stringify(readableContext)}。可編輯資料夾 ID：${JSON.stringify(editableIds)}。你可以使用自己的英語知識推薦資料夾外的相近、易混淆或相關單字，但必須標示為推薦，不可假裝原本存在。回覆必須是一個 JSON：{"reply":"給使用者的繁體中文回答","action":null}。需要修改資料時，action 只能是：{"type":"sortAlphabetically","deckIds":[...]}; {"type":"createDeck","name":"","course":"","cards":[字卡欄位]}; {"type":"renameDeck","deckId":"","name":"","course":""}; {"type":"updateCards","updates":[{"id":"",可更新欄位}]}; {"type":"moveCards","words":[...],"targetDeckId":""}。使用者沒說新資料夾要放哪個課程時，必須先在 reply 詢問，action 為 null。任何修改都只提出 action，App 會讓使用者確認後執行。一般問答或文章不需要 action。只輸出 JSON，不要 Markdown。`;
  const style = state.settings.aiChatStyle === "strict" ? "只處理英文學習；不相關話題請禮貌拒絕。" : state.settings.aiChatStyle === "relaxed" ? "語氣自然輕鬆。" : "語氣清楚自然。";
  return parseAssistantResponse(await requestAi(state.settings, `${system}\n${style}\n若 contextLimited 為 true，僅可修改明確列出的卡片，不可聲稱已核對整個資料夾。`, messages, undefined, signal,{onText}));
}

async function fetchWordDetails(state: VocabState, word: string, original?: Partial<CardDraft>): Promise<Partial<CardDraft>> {
  const prompt = `${state.settings.aiWordPrompt}\n\n目標英文單字：${word}\n現有欄位：${JSON.stringify(original ?? {word})}\n只補齊空白欄位，所有現有欄位原樣保留。如果英文例句已有內容，必須翻譯該原句並原樣回傳英文，不得另造一句中文。\n只輸出 JSON：{"cards":[{"word":"${word}","phonetic":"","partOfSpeech":"","definition":"","exampleSentence":"","exampleTranslation":"","notes":""}]}`;
  const result = parseAiCards(await requestAi(state.settings, prompt))[0];
  if (!result) throw new Error("AI 未回傳有效單字資料，請重試；原有內容已保留。");
  return result;
}

function parseImportedText(value: string): Partial<CardDraft>[] {
  const trimmed = value.trim();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try { return parseCardJson(JSON.parse(trimmed)); } catch { /* fall through to delimited text */ }
  }
  return value.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => { const [word, definition, exampleSentence = "", exampleTranslation = ""] = line.split(/[\t,，]/); return { word: word?.trim() || "", definition: definition?.trim() || "", exampleSentence: exampleSentence.trim(), exampleTranslation: exampleTranslation.trim() }; }).filter(card => card.word && card.definition);
}

function ImportSheet({ state, onClose, onImport }: { state: VocabState; onClose: () => void; onImport: (cards: Partial<CardDraft>[], deckId: string) => void }) {
  const [deckId, setDeckId] = useState(state.decks[0]?.id || ""); const [text, setText] = useState(""); const [shareUrl, setShareUrl] = useState(""); const [search, setSearch] = useState("");
  const [importMode, setImportMode] = useState<"url" | "search" | "paste" | "file">("url");
  const [candidates, setCandidates] = useState<Partial<CardDraft>[]>([]); const [busy, setBusy] = useState(false); const [status, setStatus] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const parseText = () => {
    const cards = parseImportedText(text);
    if (!cards.length) { setStatus("找不到可匯入的內容，請用「英文,中文」一行一張卡片。"); return; } setCandidates(cards);
  };
  const readFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = ""; if (!file) return;
    setStatus(""); setCandidates([]);
    if (file.type.startsWith("text/") || /\.(csv|tsv|txt|json)$/i.test(file.name)) { const raw = await file.text(); setText(raw); const cards = parseImportedText(raw); setCandidates(cards); setStatus(cards.length ? `已讀取 ${cards.length} 張真實卡片，請確認後匯入。` : "檔案裡找不到可匯入的英文與解釋欄位。"); return; }
    setStatus("這種檔案請使用「掃描文件」頁面交給多模態 AI 辨識。");
  };
  const readSharedUrl = async () => {
    if (!shareUrl.trim()) { setStatus("請先貼上分享網址"); return; }
    setBusy(true); setStatus("正在讀取公開分享頁，只會匯入網站實際回傳的內容…"); setCandidates([]);
    try {
      const response = await fetch("/api/import-url", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: shareUrl.trim() }) });
      const data = await response.json() as { cards?: Partial<CardDraft>[]; error?: string; title?: string; sourceName?: string };
      if (!response.ok || !data.cards?.length) throw new Error(data.error || "分享頁沒有公開牌組資料");
      setCandidates(data.cards); setStatus(`${data.sourceName || "公開分享頁"} 解析成功：${data.title || "單字集"}，共 ${data.cards.length} 張。`);
    } catch (error) { setStatus(`分享頁無法匯入：${(error as Error).message}`); }
    finally { setBusy(false); }
  };
  const sources = [
    ["Quizlet", `https://quizlet.com/search?query=${encodeURIComponent(search)}&type=sets`], ["AnkiWeb", `https://ankiweb.net/shared/decks?search=${encodeURIComponent(search)}`],
    ["Kahoot!", `https://create.kahoot.it/discover?query=${encodeURIComponent(search)}`], ["Brainscape", `https://www.brainscape.com/subjects/${encodeURIComponent(search)}`],
    ["Knowt", `https://knowt.com/search?search=${encodeURIComponent(search)}`], ["Cram", `https://www.cram.com/search?query=${encodeURIComponent(search)}`],
  ];
  return <SheetFrame title="匯入線上單字集" subtitle="分享網址、平台搜尋、貼上文字與檔案" onClose={onClose} wide>
    {state.decks.length === 0 ? <Empty title="請先建立資料夾" text="匯入的單字需要一個儲存位置。" /> : <div className="form"><DeckPicker state={state} value={deckId} onChange={setDeckId} />
      <div className="chips import-mode-chips">{([['url','分享網址'],['search','搜尋平台'],['paste','貼上文字'],['file','選擇檔案']] as const).map(([value,label]) => <button key={value} className={importMode === value ? "selected" : ""} onClick={() => setImportMode(value)}>{label}</button>)}</div>
      {(importMode === "url" || importMode === "search") && <ImportDeviceHelp onPaste={() => setImportMode("paste")} onFile={() => setImportMode("file")} />}
      {importMode === "url" && <div className="import-panel"><label><span>貼上分享網址</span><input inputMode="url" value={shareUrl} onChange={event => setShareUrl(event.target.value)} placeholder="https://…" /></label><button className="primary wide" disabled={busy || !shareUrl.trim()} onClick={readSharedUrl}><MdImportExport size={20} />辨識公開內容</button><p className="hint">可嘗試讀取 Quizlet、Brainscape、Knowt、Cram 的公開分享頁；不保證網站允許伺服器讀取。若出現拒絕存取、登入或人機驗證，請查看上方裝置使用方法或改用文字／檔案匯入。</p></div>}
      {importMode === "search" && <div className="import-panel"><label><span>搜尋平台</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="例如：TOEIC 600、Oxford 3000" /></label><div className="source-search-grid">{sources.map(([name,url]) => <button className="secondary" key={name} disabled={!search.trim()} onClick={() => window.open(url, "_blank", "noopener,noreferrer")}>{name}</button>)}</div><p className="hint">找到公開單字集後，複製分享網址回到「分享網址」解析。未提供公開資料的平台請下載 CSV、文字或 Anki 檔案後匯入。</p></div>}
      {importMode === "paste" && <div className="import-panel"><label><span>每行：英文［Tab 或逗號］繁體中文</span><textarea className="import-text" value={text} onChange={event => { setText(event.target.value); setCandidates([]); }} /></label><button className="secondary wide" disabled={!text.trim() || busy} onClick={parseText}>產生文字預覽</button></div>}
      {importMode === "file" && <div className="import-panel"><p>支援 CSV、TSV、TXT 與 JSON 匯出檔案。</p><button className="primary wide" onClick={() => fileRef.current?.click()}><MdAttachFile size={20} />選擇匯出檔案</button></div>}
      <input ref={fileRef} hidden type="file" accept="text/plain,text/csv,application/json,.tsv" onChange={readFile} />
      {busy && <div className="import-status"><span className="spinner" />{status}</div>}{!busy && status && <p className="import-status">{status}</p>}{candidates.length > 0 && <div className="import-preview"><div><strong>匯入預覽</strong><span>{candidates.length} 張</span></div>{candidates.slice(0, 30).map((card, index) => <article key={`${card.word}-${index}`}><span>{index + 1}</span><div><strong>{card.word}</strong><small>{card.partOfSpeech} {card.definition}</small></div></article>)}{candidates.length > 30 && <p>另外還有 {candidates.length - 30} 張</p>}<button className="primary wide" onClick={() => onImport(candidates, deckId)}>確認匯入到資料夾後方</button></div>}</div>}
  </SheetFrame>;
}

function ScanSheet({ state, onClose, onImport }: { state: VocabState; onClose: () => void; onImport: (cards: Partial<CardDraft>[], deckId: string, newFolder?:boolean) => void }) {
  type Job={id:string;file:File;url:string;status:"等待"|"辨識中"|"完成"|"失敗";error:string;cards:Partial<CardDraft>[]};
  const [scanFile,setScanFile]=useState<File|null>(null);
  const [scanOpen,setScanOpen]=useState(false),[deckId,setDeckId]=useState(state.decks[0]?.id??""),[jobs,setJobs]=useState<Job[]>([]),[busy,setBusy]=useState(false),[status,setStatus]=useState(""),[mode,setMode]=useState<ScanMode>("headwords"),[custom,setCustom]=useState(""),[candidates,setCandidates]=useState<(Partial<CardDraft>&{selected:boolean})[]>([]),[allowDuplicate,setAllowDuplicate]=useState(false);
  const photos=useRef<HTMLInputElement>(null),camera=useRef<HTMLInputElement>(null),files=useRef<HTMLInputElement>(null),abort=useRef<AbortController|null>(null),urls=useRef(new Set<string>());
  const aiAvailable=state.settings.aiEnabled&&!!(state.settings.aiApiKey||state.settings.aiProfiles?.length);
  useEffect(()=>{const allocated=urls.current;return()=>{abort.current?.abort();allocated.forEach(url=>URL.revokeObjectURL(url));};},[]);
  useEffect(()=>{const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue="";};if(busy){document.documentElement.dataset.aiBusy="true";window.addEventListener("beforeunload",warn);}return()=>{delete document.documentElement.dataset.aiBusy;window.removeEventListener("beforeunload",warn);};},[busy]);
  const addFiles=(incoming:File[])=>{if(jobs.length+incoming.length>30){setStatus("單次最多 30 個檔案，請分批匯入");return;}setJobs(current=>[...current,...incoming.map(file=>{const url=file.type.startsWith("image/")?URL.createObjectURL(file):"";if(url)urls.current.add(url);return{id:makeId(),file,url,status:"等待" as const,error:"",cards:[]};})]);};
  const run=async()=>{
    if(busy||!aiAvailable)return;setBusy(true);const controller=new AbortController();abort.current=controller;let completed=0;
    const result=new Map(jobs.map(job=>[job.id,job]));
    try{for(const [index,job] of jobs.entries()){
      if(job.status==="完成")continue;if(controller.signal.aborted)break;
      setStatus(`準備圖片／傳送／AI 辨識：第 ${index+1} / ${jobs.length} 張`);
      setJobs(current=>current.map(item=>item.id===job.id?{...item,status:"辨識中",error:""}:item));
      try{const cards=await extractCardsFromFile(state,job.file,mode,custom,controller.signal);const success={...job,status:"完成" as const,cards};result.set(job.id,success);setJobs(current=>current.map(item=>item.id===job.id?success:item));completed++;}
      catch(error){const failed={...job,status:"失敗" as const,error:controller.signal.aborted?"已停止，可重試":(error as Error).message};result.set(job.id,failed);setJobs(current=>current.map(item=>item.id===job.id?failed:item));if(controller.signal.aborted)break;}
    }}finally{
      const seen=new Set<string>(),cards:typeof candidates=[];for(const job of result.values())for(const card of job.cards){const key=normalize(card.word??"");if(!key||seen.has(key))continue;seen.add(key);cards.push({...card,selected:true});}
      setCandidates(cards);setBusy(false);abort.current=null;setStatus(`已保留 ${cards.length} 個辨識結果；本次完成 ${completed} 張。失敗圖片可重試，成功圖片不會重送。`);
    }
  };
  const close=()=>{if((busy||jobs.length)&&!confirm("離開掃描？未匯入的圖片與結果將不保留，進行中的 AI 作業會取消。"))return;abort.current?.abort();onClose();};
  return <SheetFrame title="掃描匯入" subtitle="主單字辨識 · 多張圖片 · 逐張保留結果" onClose={close} wide>
    <div className="form scan-page">{state.decks.length?<DeckPicker state={state} value={deckId} onChange={setDeckId}/>:<p className="scan-warning">尚未建立資料夾；可以先辨識，但無法匯入。</p>}<label>辨識範圍<select disabled={busy} value={mode} onChange={e=>setMode(e.target.value as ScanMode)}><option value="headwords">主單字／標題（不從例句挑字）</option><option value="listed">全部明列詞條</option><option value="custom">自訂範圍</option></select></label>{mode==="custom"&&<label>自訂指令<input disabled={busy} value={custom} onChange={e=>setCustom(e.target.value)} placeholder="例如：只辨識左欄畫線的單字"/></label>}<p className="hint">辨識範圍套用於尚未成功的圖片；已完成圖片保留原結果。</p>
    <div className="scan-source-list"><button aria-label="拍照" disabled={busy} onClick={()=>camera.current?.click()}><MdCameraAlt size={24}/></button><button aria-label="掃描" disabled={busy} onClick={()=>setScanOpen(true)}><MdDocumentScanner size={24}/></button><button aria-label="相片" disabled={busy} onClick={()=>photos.current?.click()}><MdPhotoLibrary size={24}/></button><button aria-label="檔案" disabled={busy} onClick={()=>files.current?.click()}><MdFolder size={24}/></button></div>
    {!jobs.length&&<div className="empty scan-empty"><MdDocumentScanner size={28}/><h3>等待辨識內容</h3><p>拍照、掃描文件，或多選現有圖片；只會辨識你指定的詞條範圍。</p></div>}
    <input ref={photos} hidden type="file" accept="image/*" multiple onChange={e=>{addFiles(Array.from(e.target.files??[]));e.target.value="";}}/><input ref={camera} hidden type="file" accept="image/*" capture="environment" onChange={e=>{addFiles(Array.from(e.target.files??[]));e.target.value="";}}/><input ref={files} hidden type="file" accept="image/*,application/pdf" multiple onChange={e=>{addFiles(Array.from(e.target.files??[]));e.target.value="";}}/>
    <section aria-label="圖片辨識工作清單" className="image-jobs">{jobs.map((job,index)=><article key={job.id}>{job.url&&<img src={job.url} alt={`第 ${index+1} 張`}/>}<div><strong>{index+1}. {job.file.name}</strong><p>{job.status} {job.error}</p><small>{job.cards.length} 個詞條</small></div><button className="secondary" disabled={busy||index===0} aria-label={`第 ${index+1} 張往前`} onClick={()=>setJobs(current=>{const next=[...current];[next[index-1],next[index]]=[next[index],next[index-1]];return next;})}>↑</button><button className="secondary" disabled={busy} onClick={()=>{URL.revokeObjectURL(job.url);urls.current.delete(job.url);setJobs(current=>current.filter(j=>j.id!==job.id));setCandidates([]);}}>刪除</button></article>)}</section>
    <p role="status">{status}</p>{busy?<button className="secondary" onClick={()=>abort.current?.abort()}>停止辨識（保留成功結果）</button>:<button className="primary" disabled={!aiAvailable||!jobs.some(j=>j.status!=="完成")||(mode==="custom"&&!custom.trim())} onClick={()=>void run()}>開始辨識／只重試未完成圖片</button>}{!aiAvailable&&<p>請先在設定加入支援圖片的 AI API Key。</p>}
    {!!candidates.length&&<section className="import-preview"><h3>核對結果（{candidates.length} 字）</h3><label><input type="checkbox" checked={allowDuplicate} onChange={e=>setAllowDuplicate(e.target.checked)}/>重複單字另建新資料夾（預設略過目標資料夾已有單字）</label>{candidates.map((card,index)=>{const duplicate=state.cards.some(c=>c.deckId===deckId&&normalize(c.word)===normalize(card.word??""));return <article key={index}><input type="checkbox" aria-label={`選取第 ${index+1} 個單字`} checked={card.selected} onChange={e=>setCandidates(current=>current.map((c,i)=>i===index?{...c,selected:e.target.checked}:c))}/><div><input aria-label={`第 ${index+1} 個單字`} value={card.word??""} onChange={e=>setCandidates(current=>current.map((c,i)=>i===index?{...c,word:e.target.value}:c))}/><textarea aria-label={`第 ${index+1} 個解釋`} value={card.definition??""} onChange={e=>setCandidates(current=>current.map((c,i)=>i===index?{...c,definition:e.target.value}:c))}/>{duplicate&&<small>目標資料夾已有此單字</small>}</div></article>;})}<button className="primary wide" disabled={busy||!deckId||!candidates.some(c=>c.selected&&c.word?.trim()&&c.definition?.trim())} onClick={()=>onImport(candidates.filter(c=>c.selected&&c.word?.trim()&&c.definition?.trim()),deckId,allowDuplicate)}>確認加入所選單字</button></section>}
    <input hidden type="file" data-testid="document-scan-input" accept="image/*" onChange={e=>{const file=e.target.files?.[0];e.target.value="";if(file){setScanFile(file);setScanOpen(true);}}}/>
    {scanOpen&&<DocumentScanner initialFile={scanFile??undefined} canRecognize onRecognize={async files=>{addFiles(files);return true;}} onClose={()=>{setScanOpen(false);setScanFile(null);}}/>}
    </div>
  </SheetFrame>;
}

async function fileAsBase64(file: File) {
  return await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(",")[1] || ""); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); });
}

function parseAiCards(raw: string): Partial<CardDraft>[] {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = cleaned.indexOf("{"); const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("AI 沒有回傳完整 JSON");
  const parsed = JSON.parse(cleaned.slice(start, end + 1)) as { cards?: Partial<CardDraft>[] };
  const seen = new Set<string>();
  return (parsed.cards ?? []).filter(card => {
    const word = card.word?.trim(); if (!word || seen.has(normalize(word))) return false; seen.add(normalize(word)); return true;
  }).map(card => ({ ...blankCard, ...card, word: card.word?.trim() || "" }));
}

async function extractCardsFromFile(state: VocabState, original: File, mode:ScanMode="headwords", custom="", signal?:AbortSignal) {
  const file=await prepareAiFile(original);
  if (!file.type.startsWith("image/") && state.settings.aiProvider !== "gemini") throw new Error("此供應商目前只直接接收圖片；PDF 請選 Gemini 或先轉成照片");
  const base64 = await fileAsBase64(file);
  return parseAiCards(await requestAi(state.settings, `${state.settings.aiImagePrompt}\n本次範圍指令優先：${scanInstructions(mode,custom)}`, [], { mime: file.type || "application/octet-stream", base64 },signal));
}

function speak(text: string, rate = 1) {
  return speakText(text, rate);
}
