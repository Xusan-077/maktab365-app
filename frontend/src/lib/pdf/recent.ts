import type { PdfBook } from "@/lib/pdf-books/api";

/** Qurilmada saqlanadigan "oxirgi ko'rilganlar" soni. */
export const RECENT_MAX = 12;

/** Kartani chizish uchun yetarli ixcham kitob ma'lumoti (tafsilot: mundarija, tavsif saqlanmaydi). */
export type RecentBook = Pick<
  PdfBook,
  | "id"
  | "slug"
  | "title"
  | "grade"
  | "subject"
  | "subject_title"
  | "subject_group"
  | "page_count"
  | "size_bytes"
  | "cover"
  | "unverified"
  | "published_at"
>;

export function toRecent(book: RecentBook): RecentBook {
  return {
    id: book.id,
    slug: book.slug,
    title: book.title,
    grade: book.grade,
    subject: book.subject,
    subject_title: book.subject_title,
    subject_group: book.subject_group,
    page_count: book.page_count,
    size_bytes: book.size_bytes,
    cover: book.cover,
    unverified: book.unverified,
    published_at: book.published_at,
  };
}

/** Kitobni ro'yxat boshiga qo'yadi (takror bo'lsa ko'chiradi), `max` dan ortig'ini kesadi. */
export function pushRecent(items: RecentBook[], book: RecentBook, max = RECENT_MAX): RecentBook[] {
  return [toRecent(book), ...items.filter((item) => item.id !== book.id)].slice(0, max);
}

/** Xotiradagi yozuvlardan faqat yaroqlilari (buzilgan localStorage'ga chidamli). */
export function sanitizeRecent(value: unknown): RecentBook[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (item): item is RecentBook =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as RecentBook).id === "string" &&
        typeof (item as RecentBook).slug === "string" &&
        typeof (item as RecentBook).grade === "number" &&
        typeof (item as RecentBook).title === "object" &&
        (item as RecentBook).title !== null,
    )
    .slice(0, RECENT_MAX);
}
