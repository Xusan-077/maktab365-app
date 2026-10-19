import type { BookFilters } from "@/types/catalog";
import { GRADES, type Grade } from "@/types/catalog";

export const CATALOG_PARAMS = { grade: "grade", subject: "subject", q: "q" } as const;
export const MAX_QUERY_LENGTH = 100;

/** Katalog filtrlari; hammasi URL search params'da turadi (ulashish mumkin). */
export type CatalogFilters = { grade?: Grade; subject?: string; q?: string };

/** Server (`searchParams` obyekti) ham, klient (`URLSearchParams`) ham shu orqali o'qiladi. */
export function parseCatalogParams(
  get: (name: string) => string | null | undefined,
): CatalogFilters {
  const grade = GRADES.find((item) => String(item) === get(CATALOG_PARAMS.grade));
  const subject = get(CATALOG_PARAMS.subject)?.trim();
  const q = get(CATALOG_PARAMS.q)?.trim().slice(0, MAX_QUERY_LENGTH);
  return {
    ...(grade !== undefined && { grade }),
    ...(subject && { subject }),
    ...(q && { q }),
  };
}

export function toSearchParams(filters: CatalogFilters, base?: URLSearchParams): URLSearchParams {
  const params = new URLSearchParams(base);
  for (const name of Object.values(CATALOG_PARAMS)) params.delete(name);
  if (filters.grade !== undefined) params.set(CATALOG_PARAMS.grade, String(filters.grade));
  if (filters.subject) params.set(CATALOG_PARAMS.subject, filters.subject);
  if (filters.q) params.set(CATALOG_PARAMS.q, filters.q);
  return params;
}

/** API filtri; kalit tartibi/undefined qiymatlar server va klient so'rov kalitlarini bir xil qiladi. */
export function toBookFilters(filters: CatalogFilters): BookFilters {
  return {
    ...(filters.grade !== undefined && { grade: filters.grade }),
    ...(filters.subject && { subjectId: filters.subject }),
    ...(filters.q && { q: filters.q }),
  };
}

export const hasActiveFilters = (filters: CatalogFilters) =>
  filters.grade !== undefined || !!filters.subject || !!filters.q;
