import type { Card, VocabState } from "./types";

export function localDateKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function streakStats(state: VocabState, today = new Date()): { current: number; longest: number } {
  const extra = state.androidArchive?.makeUpCheckIns;
  const days = [...new Set([...state.logs.filter(log => log.count > 0).map(log => log.date),
    ...(Array.isArray(extra) ? extra.filter((date): date is string => typeof date === "string") : [])])]
    .filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date)).sort();
  if (!days.length) return { current: 0, longest: 0 };
  let longest = 1, run = 1;
  for (let i = 1; i < days.length; i++) {
    run = Date.parse(days[i]) - Date.parse(days[i - 1]) === 86_400_000 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  if (days.at(-1) !== localDateKey(today) && days.at(-1) !== localDateKey(yesterday)) return { current: 0, longest };
  return { current: run, longest };
}

// Match SrsCalculator.kt, including Kotlin Float arithmetic and truncation.
export function scheduleReview(card: Card, rating: number, now = Date.now()): Card {
  if (!Number.isInteger(rating) || rating < 1 || rating > 4) throw new Error("Review rating must be between 1 and 4.");
  let repetitions = card.repetitionCount ?? 0;
  let interval = card.intervalDays ?? 0;
  let ease = Math.fround(Math.min(3, Math.max(1.3, card.easeFactor ?? 2.5)));
  const multiply = (a: number, b: number) => Math.fround(Math.fround(a) * Math.fround(b));
  switch (rating) {
    case 1: repetitions = 0; interval = 0; ease = Math.fround(ease - Math.fround(0.2)); break;
    case 2:
      repetitions++;
      interval = interval === 0 ? 1 : Math.max(1, Math.trunc(multiply(interval, 1.2)));
      ease = Math.fround(ease - Math.fround(0.15)); break;
    case 3:
      repetitions++;
      interval = repetitions === 1 ? 1 : repetitions === 2 ? 3 : Math.max(interval + 1, Math.trunc(multiply(interval, ease)));
      break;
    case 4:
      repetitions++;
      interval = repetitions === 1 ? 3 : repetitions === 2 ? 6 : Math.max(interval + 2, Math.trunc(multiply(multiply(interval, ease), 1.3)));
      ease = Math.fround(ease + Math.fround(0.15)); break;
  }
  interval = Math.min(3650, Math.max(0, interval));
  ease = Math.min(Math.fround(3), Math.max(Math.fround(1.3), ease));
  return { ...card, intervalDays: interval, easeFactor: ease, repetitionCount: repetitions,
    nextReviewAt: now + (interval === 0 ? 600_000 : interval * 86_400_000), lastReviewedAt: now,
    mastered: interval >= 21 };
}

export function recordCardReview(state: VocabState, cardId: string, rating: number, now = Date.now()): VocabState {
  if (!state.cards.some(card => card.id === cardId)) return state;
  const date = localDateKey(new Date(now));
  return { ...state,
    cards: state.cards.map(card => card.id === cardId ? scheduleReview(card, rating, now) : card),
    logs: state.logs.some(log => log.date === date)
      ? state.logs.map(log => log.date === date ? { ...log, count: log.count + 1 } : log)
      : [...state.logs, { date, count: 1 }],
    reviewLogs: [...(state.reviewLogs ?? []), { cardId, rating, reviewedAt: now }],
  };
}

export function undoCardReview(state: VocabState, original: Card): VocabState {
  const reviews = [...(state.reviewLogs ?? [])];
  const index = reviews.findLastIndex(log => log.cardId === original.id);
  if (index < 0) return state;
  const [removed] = reviews.splice(index, 1);
  const date = localDateKey(new Date(removed.reviewedAt));
  return { ...state, cards: state.cards.map(card => card.id === original.id ? original : card), reviewLogs: reviews,
    logs: state.logs.map(log => log.date === date ? { ...log, count: Math.max(0, log.count - 1) } : log) };
}
