export type PageItem = number | "gap";

/** Sahifa tugmalari: birinchi, oxirgi va joriy atrofidagi sahifalar; orasi "gap" (…). */
export function pageWindow(page: number, pageCount: number): PageItem[] {
  if (pageCount <= 1) return [];
  const wanted = new Set([1, pageCount, page - 1, page, page + 1]);
  // Boshida/oxirida 3 ta tugma ko'rinsin (1 2 3 … / … N-2 N-1 N)
  if (page <= 2) wanted.add(3);
  if (page >= pageCount - 1) wanted.add(pageCount - 2);
  const pages = [...wanted].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);
  const result: PageItem[] = [];
  pages.forEach((p, i) => {
    const previous = pages[i - 1];
    if (previous !== undefined) {
      // Bitta sahifalik tirqish "…" emas, raqam bilan to'ldiriladi
      if (p - previous === 2) result.push(p - 1);
      else if (p - previous > 2) result.push("gap");
    }
    result.push(p);
  });
  return result;
}

/** O'qilgan ulush, 0–100 (bet / jami). */
export function readPercent(lastPage: number, pageCount: number): number {
  if (pageCount <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((lastPage / pageCount) * 100)));
}
