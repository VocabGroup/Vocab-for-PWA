export type Deck = {
  id: string;
  name: string;
  course: string;
  description?: string;
  color: string;
  order: number;
  createdAt: number;
};

export type Card = {
  id: string;
  deckId: string;
  word: string;
  phonetic: string;
  partOfSpeech: string;
  definition: string;
  exampleSentence: string;
  exampleTranslation: string;
  notes: string;
  order: number;
  mastered: boolean;
  favorite: boolean;
  suspended: boolean;
  mistakeCount: number;
  nextReviewAt: number;
  lastReviewedAt?: number;
  intervalDays?: number;
  easeFactor?: number;
  repetitionCount?: number;
  createdAt?: number;
};

export type StudyLog = { date: string; count: number };
export type ReviewLog = { cardId: string; rating: number; reviewedAt: number };

// Preserve Android-only content until its matching editors are migrated.
// This includes grammar libraries, notes, patterns, examples, questions,
// weaknesses, writing records and make-up check-ins, with their original IDs.
export type AndroidArchive = Record<string, unknown> & { version: number };

export type QuizRecord = {
  id: string;
  deckId: string;
  mode: string;
  completedAt: number;
  total: number;
  correct: number;
  wrongCardIds: string[];
};

export type AppSettings = {
  onboardingDone: boolean;
  fullscreenOnLaunch?: boolean;
  dailyGoal: number;
  theme: "system" | "light" | "dark" | "navy" | "lightBlue" | "teal" | "green" | "pink" | "red" | "purple" | "orange" | "custom";
  customPrimary: string;
  customBackground: string;
  gradientEnabled: boolean;
  gradientStart: string;
  gradientEnd: string;
  customTextEnabled: boolean;
  customText: string;
  backgroundBrightness: number;
  backgroundOpacity: number;
  fontFamily: "default" | "serif" | "monospace";
  fontScale: number;
  dailyNewCardLimit: number;
  dailyReviewLimit: number;
  gameMistakesToReview: boolean;
  autoSpeak: boolean;
  speechRate: number;
  ttsVoiceStyle: "natural" | "female" | "male";
  ttsVoiceName: string;
  remindersEnabled: boolean;
  reminderTime: string;
  aiEnabled: boolean;
  aiRequiresConfirmation: boolean;
  usePersonalAiApi: boolean;
  aiProvider: "gemini" | "openai" | "openrouter" | "anthropic";
  aiProfiles?: { id: string; provider: AppSettings["aiProvider"]; model: string; key: string }[];
  aiChatStyle?: "normal" | "relaxed" | "strict";
  dictionarySource?: "AUTO" | "ECDICT" | "GOOGLE" | "CAMBRIDGE" | "WIKTIONARY" | "FREE";
  reminderTimes?: string[];
  ttsFrontReadWord?: boolean;
  ttsFrontSpellWord?: boolean;
  ttsFrontReadPartOfSpeech?: boolean;
  ttsFrontRepetitions?: number;
  ttsReadWord?: boolean;
  ttsSpellWord?: boolean;
  ttsReadDefinition?: boolean;
  ttsReadPhonetic?: boolean;
  ttsReadPartOfSpeech?: boolean;
  ttsReadExample?: boolean;
  ttsReadExampleTranslation?: boolean;
  ttsGroupRepetitions?: number;
  aiModel: string;
  aiApiKey: string;
  aiBaseUrl: string;
  aiWordPrompt: string;
  aiImagePrompt: string;
  ocrPreviewBeforeImport: boolean;
  pdfPageLimit: number;
  autoCheckUpdates: boolean;
  wifiOnlyUpdates: boolean;
};

export type VocabState = {
  version: 1;
  decks: Deck[];
  cards: Card[];
  logs: StudyLog[];
  quizRecords: QuizRecord[];
  reviewLogs?: ReviewLog[];
  androidArchive?: AndroidArchive;
  settings: AppSettings;
};
