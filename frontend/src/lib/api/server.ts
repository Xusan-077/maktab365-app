import { cacheLife, cacheTag } from "next/cache";
import { getApi } from "./index";
import { ApiError } from "./types";

/** 404 bo'lsa `null`, boshqa xatolar yuqoriga uzatiladi (sahifa `notFound()` yoki error boundary'ga o'tadi). */
async function orNull<T>(request: Promise<T>): Promise<T | null> {
  try {
    return await request;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

/**
 * Ochiq katalog server tomonda keshlanadi (ISR): 5 daqiqadan keyin fonda yangilanadi. Teg `content` —
 * kontent nashr qilinganda `revalidateTag("content")` bilan darhol tozalash uchun. Keshlangan
 * funksiya ichida xato bo'lsa (backend o'chiq) natija keshlanmaydi va xato sahifaga chiqadi.
 */
const CATALOG_LIFE = { stale: 60, revalidate: 300, expire: 86_400 } as const;

/** Kitob sahifasi uchun ma'lumot; metadata va sahifa bir so'rovda bitta marta oladi. */
export async function getBookPageData(bookId: string) {
  "use cache";
  cacheLife(CATALOG_LIFE);
  cacheTag("content", `book:${bookId}`);
  const api = getApi();
  const [book, chapters, subjects] = await Promise.all([
    orNull(api.getBook(bookId)),
    orNull(api.getChapters(bookId)),
    api.getSubjects(),
  ]);
  if (!book || !chapters) return null;
  const subject = subjects.find((item) => item.id === book.subjectId);
  return subject ? { book, chapters, subject } : null;
}

/** Fanlar ro'yxati sahifasi: fanlar va ulardagi kitoblar soni uchun kitoblar. */
export async function getSubjectsPageData() {
  "use cache";
  cacheLife(CATALOG_LIFE);
  cacheTag("content");
  const api = getApi();
  const [subjects, books] = await Promise.all([api.getSubjects(), api.getBooks()]);
  return { subjects, books };
}

/** Fan sahifasi uchun ma'lumot (`slug` bo'yicha). */
export async function getSubjectPageData(slug: string) {
  "use cache";
  cacheLife(CATALOG_LIFE);
  cacheTag("content", `subject:${slug}`);
  const api = getApi();
  const subjects = await api.getSubjects();
  const subject = subjects.find((item) => item.slug === slug);
  if (!subject) return null;
  const books = await api.getBooks({ subjectId: subject.id });
  return { subject, books };
}

/** Bitta mavzu (id bo'yicha); topilmasa `null`. Bosh sahifadagi namuna uchun. */
export async function getTopicById(topicId: string) {
  "use cache";
  cacheLife(CATALOG_LIFE);
  cacheTag("content", `topic:${topicId}`);
  return orNull(getApi().getTopic(topicId));
}

/** Mavzu sahifasi uchun ma'lumot: mavzu kitobga tegishli va tayyor bo'lishi shart. */
export async function getTopicPageData(bookId: string, topicId: string) {
  "use cache";
  cacheLife(CATALOG_LIFE);
  cacheTag("content", `book:${bookId}`, `topic:${topicId}`);
  const [bookData, topic] = await Promise.all([
    getBookPageData(bookId),
    orNull(getApi().getTopic(topicId)),
  ]);
  if (!bookData || !topic || topic.bookId !== bookId || !topic.ready) return null;
  const chapter = bookData.chapters.find((item) => item.id === topic.chapterId);
  if (!chapter) return null;
  const ordered = bookData.chapters.flatMap((item) => item.topics);
  const next = ordered[ordered.findIndex((item) => item.id === topic.id) + 1] ?? null;
  return { ...bookData, topic, chapter, next };
}
