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
 * kontent nashr qilinganda `revalidateTag("content")` bilan darhol tozalash uchun.
 */
const CATALOG_LIFE = { stale: 60, revalidate: 300, expire: 86_400 } as const;

type Loaded<T> = { ok: true; data: T } | { ok: false };

const isUnreachable = (error: unknown) =>
  error instanceof ApiError && (error.status === 0 || error.status >= 500);

/**
 * Keshlangan funksiya ichida backend'ga ulanib bo'lmasa (`lenient` bo'lmasa): natija sentinel bo'ladi va umri soniyalargacha
 * qisqartiriladi — Next buni keshlamaydi va prerender'da "teshik" (so'rov vaqtida to'ldiriladi) qoldiradi.
 * Shu tufayli backend'siz `next build` o'tadi, sahifalar esa birinchi so'rovda (on-demand ISR) chiqadi.
 * Xato `unwrap` da (keshdan tashqarida) qayta ko'tariladi.
 */
async function guarded<T>(load: () => Promise<T>, lenient: boolean): Promise<Loaded<T>> {
  try {
    return { ok: true, data: await load() };
  } catch (error) {
    if (!isUnreachable(error)) throw error;
    // `lenient` (metadata): "teshik" metadata'da build xatosi, shuning uchun u umumiy qiymat bilan
    // odatdagi muddatga keshlanadi; sahifa tanasi esa so'rov vaqtida to'ldiriladi.
    if (!lenient) cacheLife("seconds");
    return { ok: false };
  }
}

function unwrap<T>(loaded: Loaded<T>): T {
  if (loaded.ok) return loaded.data;
  throw new ApiError("Backend bilan aloqa yo'q", 0, { code: "network_error" });
}

async function loadBookPageData(bookId: string, lenient = false) {
  "use cache";
  cacheLife(CATALOG_LIFE);
  cacheTag("content", `book:${bookId}`);
  return guarded(async () => {
    const api = getApi();
    const [book, chapters, subjects] = await Promise.all([
      orNull(api.getBook(bookId)),
      orNull(api.getChapters(bookId)),
      api.getSubjects(),
    ]);
    if (!book || !chapters) return null;
    const subject = subjects.find((item) => item.id === book.subjectId);
    return subject ? { book, chapters, subject } : null;
  }, lenient);
}

async function loadSubjectsPageData(lenient = false) {
  "use cache";
  cacheLife(CATALOG_LIFE);
  cacheTag("content");
  return guarded(async () => {
    const api = getApi();
    const [subjects, books] = await Promise.all([api.getSubjects(), api.getBooks()]);
    return { subjects, books };
  }, lenient);
}

async function loadSubjectPageData(slug: string, lenient = false) {
  "use cache";
  cacheLife(CATALOG_LIFE);
  cacheTag("content", `subject:${slug}`);
  return guarded(async () => {
    const api = getApi();
    const subjects = await api.getSubjects();
    const subject = subjects.find((item) => item.slug === slug);
    if (!subject) return null;
    const books = await api.getBooks({ subjectId: subject.id });
    return { subject, books };
  }, lenient);
}

async function loadTopic(topicId: string, lenient = false) {
  "use cache";
  cacheLife(CATALOG_LIFE);
  cacheTag("content", `topic:${topicId}`);
  return guarded(() => orNull(getApi().getTopic(topicId)), lenient);
}

/** Kitob sahifasi uchun ma'lumot; metadata va sahifa bir so'rovda bitta marta oladi. */
export async function getBookPageData(bookId: string) {
  return unwrap(await loadBookPageData(bookId));
}

/** Fanlar ro'yxati sahifasi: fanlar va ulardagi kitoblar soni uchun kitoblar. */
export async function getSubjectsPageData() {
  return unwrap(await loadSubjectsPageData());
}

/** Fan sahifasi uchun ma'lumot (`slug` bo'yicha). */
export async function getSubjectPageData(slug: string) {
  return unwrap(await loadSubjectPageData(slug));
}

/** Bitta mavzu (id bo'yicha); topilmasa `null`. Bosh sahifadagi namuna uchun. */
export async function getTopicById(topicId: string) {
  return unwrap(await loadTopic(topicId));
}

/** Mavzu sahifasi uchun ma'lumot: mavzu kitobga tegishli va tayyor bo'lishi shart. */
export async function getTopicPageData(bookId: string, topicId: string) {
  const [bookData, topic] = await Promise.all([getBookPageData(bookId), getTopicById(topicId)]);
  if (!bookData || !topic || topic.bookId !== bookId || !topic.ready) return null;
  const chapter = bookData.chapters.find((item) => item.id === topic.chapterId);
  if (!chapter) return null;
  const ordered = bookData.chapters.flatMap((item) => item.topics);
  const next = ordered[ordered.findIndex((item) => item.id === topic.id) + 1] ?? null;
  return { ...bookData, topic, chapter, next };
}

/**
 * Metadata uchun: backend ishlamasa `undefined` (umumiy metadata), topilmasa `null` (404).
 * `generateMetadata` da "teshik" bo'lmasligi kerak, shuning uchun `lenient` yuklagichlar ishlatiladi.
 */
const lenientData = <T>(loaded: Loaded<T>): T | undefined => (loaded.ok ? loaded.data : undefined);

export async function getBookMeta(bookId: string) {
  return lenientData(await loadBookPageData(bookId, true));
}

export async function getSubjectMeta(slug: string) {
  return lenientData(await loadSubjectPageData(slug, true));
}

export async function getTopicMeta(bookId: string, topicId: string) {
  const [bookData, topic] = await Promise.all([
    getBookMeta(bookId),
    loadTopic(topicId, true).then(lenientData),
  ]);
  if (bookData === undefined || topic === undefined) return undefined;
  if (!bookData || !topic || topic.bookId !== bookId || !topic.ready) return null;
  const chapter = bookData.chapters.find((item) => item.id === topic.chapterId);
  return chapter ? { ...bookData, topic, chapter } : null;
}
