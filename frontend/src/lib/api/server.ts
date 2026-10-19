import { cache } from "react";
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

/** Kitob sahifasi uchun ma'lumot; metadata va sahifa bir so'rovda bitta marta oladi. */
export const getBookPageData = cache(async (bookId: string) => {
  const api = getApi();
  const [book, chapters, subjects] = await Promise.all([
    orNull(api.getBook(bookId)),
    orNull(api.getChapters(bookId)),
    api.getSubjects(),
  ]);
  if (!book || !chapters) return null;
  const subject = subjects.find((item) => item.id === book.subjectId);
  return subject ? { book, chapters, subject } : null;
});

/** Fan sahifasi uchun ma'lumot (`slug` bo'yicha). */
export const getSubjectPageData = cache(async (slug: string) => {
  const api = getApi();
  const subjects = await api.getSubjects();
  const subject = subjects.find((item) => item.slug === slug);
  if (!subject) return null;
  const books = await api.getBooks({ subjectId: subject.id });
  return { subject, books };
});

/** Mavzu sahifasi uchun ma'lumot: mavzu kitobga tegishli va tayyor bo'lishi shart. */
export const getTopicPageData = cache(async (bookId: string, topicId: string) => {
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
});
