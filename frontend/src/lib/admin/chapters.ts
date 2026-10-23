import type { AdminChapter, AdminChapterInput, AdminSlides } from "./types";

/** Mundarija muharriri holati: matn maydonlari qator-qator tahrirlanadi, yuborishda songa aylanadi. */
export interface ChapterRow {
  key: string;
  title: string;
  page: string;
  /** Saqlangan bo'lim id'si: yo'q bo'lsa qator hali saqlanmagan (prezentatsiya biriktirib bo'lmaydi). */
  id?: string;
}

export interface ChapterDraft extends ChapterRow {
  children: ChapterRow[];
}

/** Chegaralar backend (`pdf_services`, `models`) bilan bir xil. */
export const CHAPTER_TITLE_MAX = 200;
export const CHAPTERS_MAX = 500;
export const CHAPTER_PAGE_MAX = 100_000;
export const DESCRIPTION_MAX = 2000;

export type RowProblem = "titleRequired" | "titleTooLong" | "pageInvalid" | "pageExceeds";

let counter = 0;
export const newKey = () => `ch-${(counter += 1)}`;

export const emptyRow = (): ChapterRow => ({ key: newKey(), title: "", page: "" });
export const emptyDraft = (): ChapterDraft => ({ ...emptyRow(), children: [] });

export function fromApi(chapters: readonly AdminChapter[]): ChapterDraft[] {
  return chapters.map((chapter) => ({
    key: newKey(),
    id: chapter.id,
    title: chapter.title,
    page: String(chapter.page),
    children: (chapter.children ?? []).map((child) => ({
      key: newKey(),
      id: child.id,
      title: child.title,
      page: String(child.page),
    })),
  }));
}

/** Bo'lim id'si → prezentatsiya (serverdagi mundarijadan; ichki bo'limlar ham). */
export function slidesById(chapters: readonly AdminChapter[]): Map<string, AdminSlides | null> {
  const map = new Map<string, AdminSlides | null>();
  for (const chapter of chapters) {
    map.set(chapter.id!, chapter.slides ?? null);
    for (const child of chapter.children ?? []) map.set(child.id!, child.slides ?? null);
  }
  return map;
}

const isBlank = (row: ChapterRow) => !row.title.trim() && !row.page.trim();

/** To'liq bo'sh qatorlar tashlanadi (foydalanuvchi qo'shib qo'ygan, to'ldirmagan qator). */
export function withoutBlankRows(drafts: readonly ChapterDraft[]): ChapterDraft[] {
  return drafts
    .filter((draft) => !isBlank(draft) || draft.children.some((child) => !isBlank(child)))
    .map((draft) => ({ ...draft, children: draft.children.filter((child) => !isBlank(child)) }));
}

export function toPayload(drafts: readonly ChapterDraft[]): AdminChapterInput[] {
  // `id` bilan yuborilgan bo'lim joyida yangilanadi: prezentatsiyasi saqlanadi.
  return withoutBlankRows(drafts).map((draft) => ({
    ...(draft.id && { id: draft.id }),
    title: draft.title.trim(),
    page: Number(draft.page),
    ...(draft.children.length > 0 && {
      children: draft.children.map((child) => ({
        ...(child.id && { id: child.id }),
        title: child.title.trim(),
        page: Number(child.page),
      })),
    }),
  }));
}

export const countRows = (drafts: readonly ChapterDraft[]) =>
  withoutBlankRows(drafts).reduce((sum, draft) => sum + 1 + draft.children.length, 0);

/** Qator xatosi (`pageCount` ma'lum bo'lsa, undan katta bet ham xato); xatosiz qator — `null`. */
export function rowProblem(row: ChapterRow, pageCount?: number): RowProblem | null {
  const title = row.title.trim();
  if (!title) return "titleRequired";
  if (title.length > CHAPTER_TITLE_MAX) return "titleTooLong";
  if (!/^\d+$/.test(row.page.trim())) return "pageInvalid";
  const page = Number(row.page);
  if (page < 1 || page > CHAPTER_PAGE_MAX) return "pageInvalid";
  if (pageCount && page > pageCount) return "pageExceeds";
  return null;
}

/** Qator kaliti → xato. Bo'sh qatorlar hisobga olinmaydi. */
export function chapterProblems(
  drafts: readonly ChapterDraft[],
  pageCount?: number,
): Map<string, RowProblem> {
  const problems = new Map<string, RowProblem>();
  for (const draft of withoutBlankRows(drafts)) {
    for (const row of [draft, ...draft.children]) {
      const problem = rowProblem(row, pageCount);
      if (problem) problems.set(row.key, problem);
    }
  }
  return problems;
}

/** `items[index]` ni `delta` o'rin siljitadi (chegaradan chiqmaydi); yangi massiv qaytaradi. */
export function moveItem<T>(items: readonly T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) {
    return [...items];
  }
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

// --- Ommaviy kiritish ---

const TRAILING_PAGE = /^(.*?)[\s.·…_\-–—:|,;]*?(\d{1,6})\s*$/;
const NESTED_NUMBER = /^\s*\d+\.\d+/;

export interface BulkResult {
  rows: ChapterDraft[];
  /** Sarlavha yoki bet raqami ajratib bo'lmagan qatorlar soni. */
  skipped: number;
}

/**
 * "1. Kirish ........ 5" kabi qatorlarni sarlavha va betga ajratadi. Oxirgi son — bet; undan oldingi
 * nuqta/chiziqcha/bo'shliqlar tashlanadi. Chekinish (bo'shliq/tab) yoki "1.2" raqamlash — ichki
 * bo'lim; ota bo'lim bo'lmasa yuqori darajada qoladi.
 */
export function parseBulk(text: string): BulkResult {
  const rows: ChapterDraft[] = [];
  let skipped = 0;
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const match = TRAILING_PAGE.exec(line.trim());
    const title = match?.[1]?.replace(/\s+/g, " ").trim() ?? "";
    if (!match || !title || Number(match[2]) < 1) {
      skipped += 1;
      continue;
    }
    const nested = /^[ \t]+\S/.test(line) || NESTED_NUMBER.test(line);
    const row: ChapterRow = { key: newKey(), title, page: String(Number(match[2])) };
    const parent = rows.at(-1);
    if (nested && parent) parent.children.push(row);
    else rows.push({ ...row, children: [] });
  }
  return { rows, skipped };
}
