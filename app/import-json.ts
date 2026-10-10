/** Accept Vocab backups and term/definition JSON exports such as QuickCards. */
export function parseCardJson(value: unknown): Record<string, string>[] {
  const items = Array.isArray(value) ? value : value && typeof value === "object" && Array.isArray((value as { cards?: unknown }).cards) ? (value as { cards: unknown[] }).cards : [];
  return items.slice(0, 5000).flatMap(item => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const input = item as Record<string, unknown>;
    const read = (key: string) => typeof input[key] === "string" ? (input[key] as string).trim() : "";
    const word = read("word") || read("term");
    const definition = read("definition");
    if (!word || !definition) return [];
    return [{ word, definition, phonetic: read("phonetic"), partOfSpeech: read("partOfSpeech"), exampleSentence: read("exampleSentence"), exampleTranslation: read("exampleTranslation"), notes: read("notes") }];
  });
}
