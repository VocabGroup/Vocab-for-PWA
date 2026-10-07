import type { Card, Deck, StudyLog, VocabState } from "./types";
import { DEFAULT_IMAGE_PROMPT, DEFAULT_WORD_PROMPT } from "./prompts";

export const STORAGE_KEY = "vocab-pwa-state-v1";

export const emptyState: VocabState = {
  version: 1,
  decks: [],
  cards: [],
  logs: [],
  quizRecords: [],
  settings: {
    onboardingDone: false,
    fullscreenOnLaunch: true,
    dailyGoal: 20,
    theme: "system",
    customPrimary: "#39796D",
    customBackground: "#EAF3F1",
    gradientEnabled: false,
    gradientStart: "#DFF5EC",
    gradientEnd: "#DCEBFA",
    customTextEnabled: false,
    customText: "#173B38",
    backgroundBrightness: 1,
    backgroundOpacity: 1,
    fontFamily: "default",
    fontScale: 1,
    dailyNewCardLimit: 20,
    dailyReviewLimit: 100,
    gameMistakesToReview: true,
    autoSpeak: false,
    speechRate: 1,
    ttsVoiceStyle: "natural",
    ttsVoiceName: "",
    ttsFrontReadWord: true, ttsFrontSpellWord: false, ttsFrontReadPartOfSpeech: false, ttsFrontRepetitions: 1,
    ttsReadWord: true, ttsSpellWord: false, ttsReadDefinition: true, ttsReadPhonetic: true,
    ttsReadPartOfSpeech: true, ttsReadExample: true, ttsReadExampleTranslation: true, ttsGroupRepetitions: 2,
    dictionarySource: "AUTO", aiChatStyle: "normal", aiProfiles: [],
    remindersEnabled: false,
    reminderTime: "20:00",
    aiEnabled: true,
    aiRequiresConfirmation: true,
    usePersonalAiApi: true,
    aiProvider: "gemini",
    aiModel: "gemini-2.5-flash",
    aiApiKey: "",
    aiBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    aiWordPrompt: DEFAULT_WORD_PROMPT,
    aiImagePrompt: DEFAULT_IMAGE_PROMPT,
    ocrPreviewBeforeImport: true,
    pdfPageLimit: 20,
    autoCheckUpdates: true,
    wifiOnlyUpdates: true,
  },
};

export function loadState(): VocabState {
  if (typeof window === "undefined") return emptyState;
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? parseStoredState(JSON.parse(raw)) : emptyState;
}

export function parseStoredState(input: unknown): VocabState {
  const state = normalizeWebBackup(input as Partial<VocabState>);
  const record = asRecord(input);
  const settings = asRecord(record?.settings);
  return { ...state, settings: { ...state.settings, onboardingDone: settings?.onboardingDone === true } };
}

export function saveState(state: VocabState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function downloadBackup(state: VocabState) {
  const portableState: VocabState = { ...state, settings: { ...state.settings, aiApiKey: "", aiProfiles: [] } };
  const blob = new Blob([JSON.stringify(portableState, null, 2)], { type: "application/json" });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = `vocab-backup-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  // Safari may consume the download URL after the click handler returns.
  window.setTimeout(() => URL.revokeObjectURL(href), 60_000);
}

export function normalizeBackup(input: unknown): VocabState {
  if (!input || typeof input !== "object") throw new Error("這不是有效的 Vocab 備份檔");
  const object = input as Record<string, unknown>;
  if (object.format === "vocab-backup" || object.format === "vocabpulse-backup" || Array.isArray(object.studyLogs)) {
    return normalizeAndroidBackup(object);
  }
  return normalizeWebBackup(object as Partial<VocabState>);
}

function normalizeWebBackup(raw: Partial<VocabState>): VocabState {
  if (!raw || typeof raw !== "object") throw new Error("這不是有效的 Vocab 備份檔");
  if (raw.version !== 1) throw new Error("備份版本不支援");
  if (!Array.isArray(raw.decks) || !Array.isArray(raw.cards)) throw new Error("備份缺少資料夾或單字卡");
  const decks = raw.decks.filter(deck => deck && typeof deck.id === "string" && typeof deck.name === "string" && typeof deck.course === "string");
  const cards = raw.cards.filter(card => card && typeof card.id === "string" && typeof card.deckId === "string" && typeof card.word === "string" && typeof card.definition === "string");
  if (decks.length !== raw.decks.length || cards.length !== raw.cards.length) throw new Error("備份內含損壞的資料夾或單字卡");
  const deckIds = new Set(decks.map(deck => deck.id)); const cardIds = new Set(cards.map(card => card.id));
  if (deckIds.size !== decks.length || cardIds.size !== cards.length) throw new Error("備份內有重複的資料 ID");
  if (cards.some(card => !deckIds.has(card.deckId))) throw new Error("備份中有單字卡找不到所屬資料夾");
  return {
    version: 1,
    decks: decks.map((deck, index) => ({ ...deck, order: Number.isFinite(deck.order) ? deck.order : index, color: deck.color || "#426B63", createdAt: Number.isFinite(deck.createdAt) ? deck.createdAt : Date.now() })),
    cards: cards.map((card, index) => ({ ...card, order: Number.isFinite(card.order) ? card.order : index, phonetic: card.phonetic || "", partOfSpeech: card.partOfSpeech || "", exampleSentence: card.exampleSentence || "", exampleTranslation: card.exampleTranslation || "", notes: card.notes || "", mastered: Boolean(card.mastered), favorite: Boolean(card.favorite), suspended: Boolean(card.suspended), mistakeCount: Number.isFinite(card.mistakeCount) ? card.mistakeCount : 0, nextReviewAt: Number.isFinite(card.nextReviewAt) ? card.nextReviewAt : Date.now(), intervalDays: valueNumber(card.intervalDays, 0), easeFactor: valueNumber(card.easeFactor, 2.5), repetitionCount: valueNumber(card.repetitionCount, 0) })),
    logs: Array.isArray(raw.logs) ? raw.logs.filter(log => log && typeof log.date === "string" && Number.isFinite(log.count)) : [],
    quizRecords: Array.isArray(raw.quizRecords) ? raw.quizRecords.filter(record => record && typeof record.id === "string" && typeof record.deckId === "string" && Array.isArray(record.wrongCardIds)) : [],
    reviewLogs: Array.isArray(raw.reviewLogs) ? raw.reviewLogs.filter(log => log && typeof log.cardId === "string" && Number.isFinite(log.rating) && Number.isFinite(log.reviewedAt)) : [],
    ...(raw.androidArchive && typeof raw.androidArchive === "object" ? { androidArchive: raw.androidArchive } : {}),
    settings: { ...emptyState.settings, ...(raw.settings && typeof raw.settings === "object" ? raw.settings : {}),
      theme: raw.settings?.theme === "dark" || raw.settings?.theme === "light" ? raw.settings.theme : "system",
      gradientEnabled: false, customTextEnabled: false, backgroundBrightness: 1, backgroundOpacity: 1, onboardingDone: true },
  };
}

function normalizeAndroidBackup(raw: Record<string, unknown>): VocabState {
  if (!Number.isInteger(raw.version) || Number(raw.version) < 1 || Number(raw.version) > 8) throw new Error("Android 備份版本不支援（目前支援第 1–8 版）");
  if (!Array.isArray(raw.decks) || !Array.isArray(raw.cards)) throw new Error("Android 備份缺少資料夾或單字卡");

  const sourceDecks = raw.decks.map(asRecord);
  const sourceCards = raw.cards.map(asRecord);
  if (sourceDecks.some(deck => !deck) || sourceCards.some(card => !card)) throw new Error("Android 備份內含損壞的資料");

  const decks: Deck[] = sourceDecks.map((item, index) => {
    const id = valueId(item?.id);
    const name = valueText(item?.name).trim();
    if (!id || !name) throw new Error("Android 備份內含無效的資料夾");
    return {
      id,
      name,
      course: valueText(item?.category).trim() || "通用",
      description: valueText(item?.description),
      color: valueText(item?.colorHex) || "#426B63",
      order: valueNumber(item?.sortOrder, index),
      createdAt: valueNumber(item?.createdAt, Date.now()),
    };
  });

  const deckIds = new Set(decks.map(deck => deck.id));
  if (deckIds.size !== decks.length) throw new Error("Android 備份內有重複的資料夾 ID");
  const orderInDeck = new Map<string, number>();
  const cards: Card[] = sourceCards.map(item => {
    const id = valueId(item?.id);
    const deckId = valueId(item?.deckId);
    const word = valueText(item?.word).trim();
    if (!id || !deckId || !word || !deckIds.has(deckId)) throw new Error("Android 備份內含無效或無所屬資料夾的單字卡");
    const order = orderInDeck.get(deckId) ?? 0;
    orderInDeck.set(deckId, order + 1);
    const lastReviewedAt = optionalNumber(item?.lastReviewedTimestamp);
    return {
      id,
      deckId,
      word,
      phonetic: valueText(item?.phonetic),
      partOfSpeech: valueText(item?.partOfSpeech),
      definition: valueText(item?.definition),
      exampleSentence: valueText(item?.exampleSentence),
      exampleTranslation: valueText(item?.exampleTranslation),
      notes: valueText(item?.notes),
      order: valueNumber(item?.sortOrder, order),
      mastered: item?.isMastered === true,
      favorite: item?.isFavorite === true,
      suspended: item?.isSuspended === true,
      mistakeCount: valueNumber(item?.mistakeCount, 0),
      nextReviewAt: valueNumber(item?.nextReviewTimestamp, Date.now()),
      intervalDays: valueNumber(item?.intervalDays, 0),
      easeFactor: valueNumber(item?.easeFactor, 2.5),
      repetitionCount: valueNumber(item?.repetitionCount, 0),
      createdAt: valueNumber(item?.createdAt, Date.now()),
      ...(lastReviewedAt === undefined ? {} : { lastReviewedAt }),
    };
  });

  if (new Set(cards.map(card => card.id)).size !== cards.length) throw new Error("Android 備份內有重複的單字卡 ID");
  const logs = normalizeAndroidLogs(Array.isArray(raw.studyLogs) ? raw.studyLogs : []);
  return {
    version: 1,
    decks,
    cards,
    logs,
    quizRecords: [],
    reviewLogs: (Array.isArray(raw.studyLogs) ? raw.studyLogs : []).flatMap(value => {
      const item = asRecord(value);
      const cardId = valueId(item?.cardId);
      return item && cardId && cards.some(card => card.id === cardId) && optionalNumber(item.reviewedAt) !== undefined
        ? [{ cardId, rating: valueNumber(item.rating, 3), reviewedAt: Number(item.reviewedAt) }] : [];
    }),
    androidArchive: { ...raw, version: Number(raw.version) },
    settings: { ...emptyState.settings, onboardingDone: true },
  };
}

export function createAndroidBackup(state: VocabState, now = Date.now()): Record<string, unknown> {
  // Map web UUIDs to Room-compatible numeric IDs; keep IDs already in Android backups.
  const mapIds = (ids: string[]) => {
    const taken = new Set(ids.filter(id => /^[1-9]\d*$/.test(id) && Number.isSafeInteger(Number(id))).map(Number));
    let next = 1;
    return new Map(ids.map(id => {
      if (/^[1-9]\d*$/.test(id) && Number.isSafeInteger(Number(id))) return [id, Number(id)] as const;
      while (taken.has(next)) next++;
      taken.add(next);
      return [id, next++] as const;
    }));
  };
  const deckIds = mapIds(state.decks.map(deck => deck.id));
  const cardIds = mapIds(state.cards.map(card => card.id));
  return { ...(state.androidArchive ?? {}), format: "vocab-backup", version: 8, exportedAt: now,
    decks: state.decks.map(deck => ({ id: deckIds.get(deck.id), name: deck.name, category: deck.course,
      description: deck.description ?? "", colorHex: deck.color, createdAt: deck.createdAt, sortOrder: deck.order })),
    cards: state.cards.map(card => ({ id: cardIds.get(card.id), deckId: deckIds.get(card.deckId),
      word: card.word, phonetic: card.phonetic, partOfSpeech: card.partOfSpeech, definition: card.definition,
      exampleSentence: card.exampleSentence, exampleTranslation: card.exampleTranslation, notes: card.notes,
      isMastered: card.mastered, isFavorite: card.favorite, isSuspended: card.suspended, mistakeCount: card.mistakeCount,
      intervalDays: card.intervalDays ?? 0, easeFactor: card.easeFactor ?? 2.5, repetitionCount: card.repetitionCount ?? 0,
      nextReviewTimestamp: card.nextReviewAt, lastReviewedTimestamp: card.lastReviewedAt ?? null,
      createdAt: card.createdAt ?? now, sortOrder: card.order })),
    studyLogs: (state.reviewLogs ?? []).filter(log => cardIds.has(log.cardId)).map(log => ({ ...log, cardId: cardIds.get(log.cardId) })),
  };
}

export function downloadAndroidBackup(state: VocabState) {
  const href = URL.createObjectURL(new Blob([JSON.stringify(createAndroidBackup(state), null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = `vocab-android-backup-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(href), 60_000);
}

function normalizeAndroidLogs(items: unknown[]): StudyLog[] {
  const counts = new Map<string, number>();
  items.forEach(value => {
    const item = asRecord(value);
    const reviewedAt = optionalNumber(item?.reviewedAt);
    if (reviewedAt === undefined) return;
    const date = new Date(reviewedAt);
    if (Number.isNaN(date.getTime())) return;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return [...counts].sort(([left], [right]) => left.localeCompare(right)).map(([date, count]) => ({ date, count }));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function valueId(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function valueText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function valueNumber(value: unknown, fallback: number): number {
  return optionalNumber(value) ?? fallback;
}
