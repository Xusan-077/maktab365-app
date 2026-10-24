import type { PdfSubject } from "@/lib/pdf-books/api";
import { normalizeSearchText } from "@/lib/i18n/translit";
import { SUBJECT_GROUPS, type SubjectGroup } from "./grade-groups";
import { toSubjectGroup } from "@/lib/subject-colors";

/** `/fanlar` bo'limi: backend guruhi, yoki guruhi bo'sh/noma'lum fanlar uchun `other`. */
export type SubjectSectionKey = SubjectGroup | "other";

export interface SubjectSection {
  key: SubjectSectionKey;
  subjects: PdfSubject[];
}

/** Tab kaliti: `all` yoki bo'lim. */
export type SubjectTab = "all" | SubjectSectionKey;

const SECTION_ORDER: readonly SubjectSectionKey[] = [...SUBJECT_GROUPS, "other"];

/**
 * Fanlarni guruhlarga ajratadi (guruh tartibi qat'iy, ichida `order`), qidiruv matni (har qanday
 * tildagi nom, kirill/lotin va tutuq belgisiga e'tiborsiz) va tab bo'yicha filtrlaydi. Bo'sh bo'limlar tushadi.
 */
export function buildSections(
  subjects: readonly PdfSubject[],
  query: string,
  tab: SubjectTab,
): SubjectSection[] {
  const needle = normalizeSearchText(query.trim());
  const matches = (subject: PdfSubject) =>
    !needle ||
    Object.values(subject.title).some((text) => text && normalizeSearchText(text).includes(needle));

  const buckets = new Map<SubjectSectionKey, PdfSubject[]>();
  for (const subject of subjects) {
    if (!matches(subject)) continue;
    const key: SubjectSectionKey = toSubjectGroup(subject.group) ?? "other";
    buckets.set(key, [...(buckets.get(key) ?? []), subject]);
  }
  return SECTION_ORDER.filter((key) => (tab === "all" || tab === key) && buckets.has(key)).map(
    (key) => ({
      key,
      subjects: [...buckets.get(key)!].sort((a, b) => a.order - b.order),
    }),
  );
}

/** Tablar: faqat fani bor bo'limlar (qidiruvga bog'liq emas). */
export function availableTabs(subjects: readonly PdfSubject[]): SubjectTab[] {
  const present = new Set(subjects.map((s) => toSubjectGroup(s.group) ?? "other"));
  return ["all", ...SECTION_ORDER.filter((key) => present.has(key))];
}
