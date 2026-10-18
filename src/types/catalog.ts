import type { LocalizedText } from "./i18n";

export const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;
export type Grade = (typeof GRADES)[number];

export type Subject = {
  id: string;
  slug: string;
  name: LocalizedText;
};

export type Book = {
  id: string;
  title: LocalizedText;
  grade: Grade;
  subjectId: string;
  author: LocalizedText;
  /** Muqova rasmi; yo'q bo'lsa UI placeholder ko'rsatadi. */
  coverUrl?: string;
  publishedYear: number;
  /** Nashr (masalan, "2-nashr, qayta ishlangan"). */
  edition: LocalizedText;
  pdfUrl?: string;
  /** Mavzular platformada tayyor (kitob mavzular bo'yicha o'qiladimi). */
  topicsReady: boolean;
};

export type BookFilters = {
  grade?: Grade;
  subjectId?: string;
  /** Kitob nomi/muallifi bo'yicha qidiruv. */
  q?: string;
};

/** Mavzuning ro'yxatdagi qisqa ko'rinishi (bloklarsiz). */
export type TopicSummary = {
  id: string;
  bookId: string;
  chapterId: string;
  order: number;
  title: LocalizedText;
  /** Mavzu matni to'ldirilgan (bloklari bor). */
  ready: boolean;
};

export type Chapter = {
  id: string;
  bookId: string;
  order: number;
  title: LocalizedText;
  topics: TopicSummary[];
};
