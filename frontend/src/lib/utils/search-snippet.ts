/** Backend qidiruv snippetidagi belgilar: mos so'zlar `⟦…⟧` ichida (`apps/content/search.py`). */
export const SNIPPET_MARK_START = "⟦";
export const SNIPPET_MARK_END = "⟧";

export type SnippetPart = { text: string; match: boolean };

/**
 * Snippetni oddiy matn va belgilangan (mos) bo'laklarga ajratadi. HTML ishlatilmaydi — matn React'da
 * oddiy matn sifatida chiziladi (kontentdagi `<` kabi belgilar xavfsiz). Yopilmagan belgi oddiy matn.
 */
export function splitSnippet(snippet: string): SnippetPart[] {
  const parts: SnippetPart[] = [];
  let rest = snippet;
  while (rest) {
    const start = rest.indexOf(SNIPPET_MARK_START);
    const end = start === -1 ? -1 : rest.indexOf(SNIPPET_MARK_END, start + 1);
    if (start === -1 || end === -1) {
      parts.push({
        text: rest.replaceAll(SNIPPET_MARK_START, "").replaceAll(SNIPPET_MARK_END, ""),
        match: false,
      });
      break;
    }
    if (start > 0) parts.push({ text: rest.slice(0, start), match: false });
    parts.push({ text: rest.slice(start + 1, end), match: true });
    rest = rest.slice(end + 1);
  }
  return parts.filter((part) => part.text !== "");
}
