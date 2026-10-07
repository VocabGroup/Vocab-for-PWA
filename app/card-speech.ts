import type { AppSettings, Card } from "./types";

export function cardSpeechParts(card: Card, settings: AppSettings, back: boolean): { text: string; language: string }[] {
  const parts: { text: string; language: string }[] = [];
  const add = (enabled: boolean | undefined, fallback: boolean, text: string, language = "en-US") => { if ((enabled ?? fallback) && text.trim()) parts.push({ text, language }); };
  if (!back) {
    add(settings.ttsFrontReadWord, true, card.word);
    add(settings.ttsFrontSpellWord, false, card.word.split("").join(". "));
    add(settings.ttsFrontReadPartOfSpeech, false, card.partOfSpeech);
  } else {
    add(settings.ttsReadWord, true, card.word); add(settings.ttsSpellWord, false, card.word.split("").join(". "));
    add(settings.ttsReadDefinition, true, card.definition, "zh-TW"); add(settings.ttsReadPhonetic, true, card.phonetic);
    add(settings.ttsReadPartOfSpeech, true, card.partOfSpeech); add(settings.ttsReadExample, true, card.exampleSentence);
    add(settings.ttsReadExampleTranslation, true, card.exampleTranslation, "zh-TW");
  }
  const count = Math.min(3, Math.max(1, Math.floor((back ? settings.ttsGroupRepetitions : settings.ttsFrontRepetitions) ?? (back ? 2 : 1))));
  return Array.from({ length: count }, () => parts).flat();
}
