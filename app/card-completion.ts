import type { Card } from "./types";

export function mergeCardCompletion<T extends Partial<Card>>(original: T, generated: Partial<Card>): T {
  if (original.word?.trim().toLowerCase() !== generated.word?.trim().toLowerCase()) return original;
  const sameSentence = !original.exampleSentence?.trim() || original.exampleSentence.trim() === generated.exampleSentence?.trim();
  return { ...original, phonetic: original.phonetic || generated.phonetic || "", partOfSpeech: original.partOfSpeech || generated.partOfSpeech || "",
    definition: original.definition || generated.definition || "", exampleSentence: original.exampleSentence || generated.exampleSentence || "",
    exampleTranslation: original.exampleTranslation || (sameSentence ? generated.exampleTranslation : "") || "", notes: original.notes || generated.notes || "" };
}
