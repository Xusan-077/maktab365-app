/** Kitob ichida qidiruv: pdf.js matn qatlamidan sahifa natijalari va sahifadagi belgilash joylari. */

/** Qidiruv so'zi shuncha belgidan boshlanadi. */
export const FIND_MIN_LENGTH = 2;
/** Ro'yxatga shuncha sahifa natijasi olinadi (keyin qidiruv to'xtaydi). */
export const FIND_MAX_PAGES = 200;
/** Snippet: topilgan so'z atrofida shuncha belgi. */
const SNIPPET_RADIUS = 36;
/** Shuncha sahifa o'qilib ham matn topilmasa PDF skaner (matn qatlami yo'q) deb hisoblanadi. */
export const SCAN_PROBE_PAGES = 12;

/** Katta-kichik harf va ortiqcha bo'shliqlarga e'tiborsiz taqqoslash uchun. */
export function normalizeText(text: string): string {
  return text.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, " ");
}

export function normalizeTerm(term: string): string {
  return normalizeText(term).trim();
}

/** `needle` ning `haystack`dagi barcha (kesishmaydigan) boshlanish indekslari. */
export function indexesOf(haystack: string, needle: string): number[] {
  if (!needle) return [];
  const found: number[] = [];
  for (let from = 0; ;) {
    const at = haystack.indexOf(needle, from);
    if (at < 0) return found;
    found.push(at);
    from = at + needle.length;
  }
}

export interface PageHit {
  page: number;
  /** Sahifadagi moslashuvlar soni. */
  count: number;
  /** Birinchi moslashuv atrofidagi matn. */
  before: string;
  match: string;
  after: string;
}

/** Bitta sahifa matnidan natija (moslashuv yo'q bo'lsa `null`). */
export function pageHit(page: number, rawText: string, term: string): PageHit | null {
  const text = normalizeText(rawText);
  const needle = normalizeTerm(term);
  const indexes = indexesOf(text, needle);
  if (indexes.length === 0) return null;
  const at = indexes[0];
  const start = Math.max(0, at - SNIPPET_RADIUS);
  const end = Math.min(text.length, at + needle.length + SNIPPET_RADIUS);
  return {
    page,
    count: indexes.length,
    before: `${start > 0 ? "…" : ""}${text.slice(start, at).trimStart()}`,
    match: text.slice(at, at + needle.length),
    after: `${text.slice(at + needle.length, end).trimEnd()}${end < text.length ? "…" : ""}`,
  };
}

interface TextItem {
  str: string;
}
interface FindablePage {
  getTextContent(): Promise<{ items: readonly (TextItem | object)[] }>;
}
export interface FindableDocument {
  numPages: number;
  getPage(pageNumber: number): Promise<FindablePage>;
}

export interface FindResult {
  hits: PageHit[];
  /** Hamma sahifa ko'rib chiqildi (natijalar soni chegarasiga yetmasdan). */
  complete: boolean;
  /** Boshidagi sahifalarda matn umuman yo'q: PDF skaner qilingan rasm. */
  scanned: boolean;
}

export const pageText = (items: readonly (TextItem | object)[]): string =>
  items.map((item) => ("str" in item ? item.str : "")).join(" ");

/**
 * Hujjat bo'ylab ketma-ket qidiradi. `onProgress(sahifa, hozirgi natijalar)` har sahifadan keyin;
 * `signal` bekor qilinsa to'xtaydi. Matn qatlami yo'q (skaner) PDF uchun `scanned` belgilanadi.
 */
export async function searchDocument(
  doc: FindableDocument,
  term: string,
  options: {
    signal?: AbortSignal;
    onProgress?: (page: number, hits: PageHit[]) => void;
  } = {},
): Promise<FindResult> {
  const needle = normalizeTerm(term);
  const hits: PageHit[] = [];
  let anyText = false;
  for (let page = 1; page <= doc.numPages; page += 1) {
    if (options.signal?.aborted) return { hits, complete: false, scanned: false };
    const content = await (await doc.getPage(page)).getTextContent();
    const text = pageText(content.items);
    if (text.trim()) anyText = true;
    const hit = needle ? pageHit(page, text, term) : null;
    if (hit) hits.push(hit);
    options.onProgress?.(page, hits);
    if (hits.length >= FIND_MAX_PAGES) return { hits, complete: false, scanned: false };
    if (!anyText && page >= SCAN_PROBE_PAGES) return { hits, complete: false, scanned: true };
  }
  return { hits, complete: true, scanned: !anyText };
}

export interface NormalizedRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PositionedItem {
  str: string;
  /** PDF matn matritsasi `[a, b, c, d, e, f]`: (e, f) — boshlang'ich nuqta. */
  transform: readonly number[];
  width: number;
  height: number;
}

/**
 * Sahifadagi moslashuvlar joylashuvi (0..1 oraliqda, sahifa eni/bo'yiga nisbatan). Har bir matn
 * bo'lagi ichida harflar bir tekis taqsimlangan deb hisoblanadi. `toViewport([x1,y1,x2,y2])`
 * PDF koordinatalarini viewport piksellariga o'tkazadi (pdf.js `convertToViewportRectangle`).
 */
export function matchRects(
  items: readonly PositionedItem[],
  term: string,
  toViewport: (rect: [number, number, number, number]) => number[],
  pageWidth: number,
  pageHeight: number,
): NormalizedRect[] {
  const needle = normalizeTerm(term);
  if (!needle || pageWidth <= 0 || pageHeight <= 0) return [];
  const rects: NormalizedRect[] = [];
  for (const item of items) {
    const text = normalizeText(item.str);
    if (!text || text.length !== item.str.length) continue; // belgilar soni o'zgarsa joylashuv noaniq
    for (const at of indexesOf(text, needle)) {
      const x1 = item.transform[4] + (at / text.length) * item.width;
      const x2 = item.transform[4] + ((at + needle.length) / text.length) * item.width;
      const baseline = item.transform[5];
      const height = item.height || Math.hypot(item.transform[2], item.transform[3]);
      const [ax, ay, bx, by] = toViewport([
        x1,
        baseline - 0.2 * height,
        x2,
        baseline + 0.85 * height,
      ]);
      rects.push({
        x: Math.min(ax, bx) / pageWidth,
        y: Math.min(ay, by) / pageHeight,
        w: Math.abs(bx - ax) / pageWidth,
        h: Math.abs(by - ay) / pageHeight,
      });
    }
  }
  return rects;
}
