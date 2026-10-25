/** PDF mundarijasi: tekis ro'yxat, boblar bo'yicha guruhlar, joriy bo'lim va qidiruv (sof funksiyalar). */

import { normalizeSearchText } from "@/lib/i18n/translit";

/** Bo'lim ichidagi mashq/masala boshlanishi (backend `anchors`, ixtiyoriy — `docs/api-mavzu-materiallari.md`). */
export interface TocAnchor {
  kind: "exercise" | "problem";
  title: string;
  page: number;
}

export interface TocLeaf {
  id: string;
  title: string;
  page: number;
  /** Ixtiyoriy prezentatsiya (PDF slaydlar); yo'q bo'lsa `null`/berilmaydi. */
  slides?: { page_count: number; size_bytes: number } | null;
  anchors?: readonly TocAnchor[] | null;
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
      anchors: chapter.anchors ?? null,
      level: 0 as const,
    },
    ...(chapter.children ?? []).map((child) => ({
      id: child.id,
      title: child.title,
      page: child.page,
      slides: child.slides ?? null,
      anchors: child.anchors ?? null,
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

export type TocStatus = "read" | "current" | "unread";

/**
 * Har bo'lim holati joriy betga nisbatan: joriy bo'lim — `current`, undan oldingilari — `read`,
 * keyingilari — `unread`. Bob faqat oxirgi bo'limi ham o'tilgan bo'lsa `read`; joriy bo'lim shu
 * bob ichida bo'lsa bob ham `current`.
 */
export function tocStatuses(groups: readonly TocGroup[], page: number): Map<string, TocStatus> {
  const items = groups.flatMap((group) => [group.chapter, ...group.sections]);
  const current = currentTocItem(items, page);
  const currentIndex = current ? items.indexOf(current) : -1;
  const statuses = new Map<string, TocStatus>();
  items.forEach((item, index) =>
    statuses.set(
      item.id,
      index === currentIndex ? "current" : index < currentIndex ? "read" : "unread",
    ),
  );
  for (const group of groups) {
    if (group.sections.some((section) => section.id === current?.id)) {
      statuses.set(group.chapter.id, "current");
    } else if (group.sections.length > 0 && statuses.get(group.chapter.id) === "read") {
      const last = group.sections.at(-1);
      if (last && statuses.get(last.id) !== "read") statuses.set(group.chapter.id, "unread");
    }
  }
  return statuses;
}

/** Bo'lim sarlavhasidagi qisqa belgi: "15-§. Kvadrat tenglama" → "15-§", "§ 3 …" → "3-§"; yo'q — `null`. */
export function sectionLabel(title: string): string | null {
  const match = /(\d{1,3})\s*-?\s*§|§\s*(\d{1,3})/.exec(title);
  if (!match) return null;
  return `${match[1] ?? match[2]}-§`;
}

/** Slider ustidagi bo'lim belgilari: har bo'lim boshlanishi 0..1 ulushda (1-betdagilar chiqmaydi). */
export function tocMarkers(
  items: readonly TocItem[],
  total: number,
): { id: string; page: number; at: number; level: 0 | 1 }[] {
  if (total <= 1) return [];
  const seen = new Set<number>();
  return items.flatMap((item) => {
    if (item.page <= 1 || item.page > total || seen.has(item.page)) return [];
    seen.add(item.page);
    return [{ id: item.id, page: item.page, at: (item.page - 1) / (total - 1), level: item.level }];
  });
}
