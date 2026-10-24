/** PDF mundarijasi: tekis ro'yxat, boblar bo'yicha guruhlar, joriy bo'lim va qidiruv (sof funksiyalar). */

import { normalizeSearchText } from "@/lib/i18n/translit";

export interface TocLeaf {
  id: string;
  title: string;
  page: number;
  /** Ixtiyoriy prezentatsiya (PDF slaydlar); yo'q bo'lsa `null`/berilmaydi. */
  slides?: { page_count: number; size_bytes: number } | null;
}

export interface TocChapter extends TocLeaf {
  children?: TocLeaf[];
}

export interface TocItem extends TocLeaf {
  /** 0 — yuqori daraja, 1 — ichki bo'lim. */
  level: 0 | 1;
}

/** Daraxt → hujjat tartibidagi tekis ro'yxat (bo'lim, uning ichki bo'limlari, keyingi bo'lim…). */
export function flattenToc(chapters: readonly TocChapter[]): TocItem[] {
  return chapters.flatMap((chapter) => [
    {
      id: chapter.id,
      title: chapter.title,
      page: chapter.page,
      slides: chapter.slides ?? null,
      level: 0 as const,
    },
    ...(chapter.children ?? []).map((child) => ({
      id: child.id,
      title: child.title,
      page: child.page,
      slides: child.slides ?? null,
      level: 1 as const,
    })),
  ]);
}

/**
 * Joriy bo'lim: sahifasi `page` dan oshmagan bo'limlarning eng kattasi. Sahifalar teng bo'lsa
 * ro'yxatda keyingisi (ichki bo'lim yuqori darajadan aniqroq). Hech biri yetmagan bo'lsa `null`.
 */
export function currentTocItem(items: readonly TocItem[], page: number): TocItem | null {
  let current: TocItem | null = null;
  for (const item of items) {
    if (item.page <= page && (current === null || item.page >= current.page)) current = item;
  }
  return current;
}

/** Bob (level 0) va uning bo'limlari (level 1). Bo'limsiz bob — `sections` bo'sh. */
export interface TocGroup {
  chapter: TocItem;
  sections: TocItem[];
}

/** Shuncha qatordan ko'p bo'lsa mundarija ichida qidiruv chiqadi. */
export const TOC_SEARCH_THRESHOLD = 20;

export function groupToc(chapters: readonly TocChapter[]): TocGroup[] {
  const groups: TocGroup[] = [];
  for (const item of flattenToc(chapters)) {
    if (item.level === 0) groups.push({ chapter: item, sections: [] });
    else groups.at(-1)?.sections.push(item);
  }
  return groups;
}

export const tocRowCount = (groups: readonly TocGroup[]) =>
  groups.reduce((sum, group) => sum + 1 + group.sections.length, 0);

/** Joriy bo'lim (`currentTocItem`) joylashgan bob id'si; sahifa noma'lum yoki hech biri yetmagan — `null`. */
export function currentTocGroupId(groups: readonly TocGroup[], page: number | null): string | null {
  if (page === null) return null;
  const current = currentTocItem(
    groups.flatMap((group) => [group.chapter, ...group.sections]),
    page,
  );
  if (!current) return null;
  return (
    groups.find((group) => group.chapter.id === current.id || group.sections.includes(current))
      ?.chapter.id ?? null
  );
}

/**
 * Mundarija ichida qidiruv (lotin/kirill, katta-kichik harf va tutuq belgisiz): bob nomi mos
 * kelsa — butun bob, aks holda faqat mos bo'limlari bilan. Bo'sh so'rov — o'zgarmaydi.
 */
export function filterTocGroups(groups: readonly TocGroup[], query: string): readonly TocGroup[] {
  const needle = normalizeSearchText(query.trim());
  if (!needle) return groups;
  const matches = (item: TocItem) => normalizeSearchText(item.title).includes(needle);
  return groups.flatMap((group) => {
    if (matches(group.chapter)) return [group];
    const sections = group.sections.filter(matches);
    return sections.length > 0 ? [{ ...group, sections }] : [];
  });
}
