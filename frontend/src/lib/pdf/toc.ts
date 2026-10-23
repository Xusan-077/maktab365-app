/** PDF mundarijasi: tekis ro'yxat va joriy bo'lim (sof funksiyalar). */

export interface TocLeaf {
  id: string;
  title: string;
  page: number;
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
    { id: chapter.id, title: chapter.title, page: chapter.page, level: 0 as const },
    ...(chapter.children ?? []).map((child) => ({
      id: child.id,
      title: child.title,
      page: child.page,
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
