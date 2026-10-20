import { CONTENT_REGISTRY } from "@/content/registry";
import { routing } from "@/lib/i18n/routing";
import { API_MODE, getApi } from "./index";

/**
 * `generateStaticParams` uchun umumiy ro'yxatlar: marketing va panel sahifalari bir xil yo'llarni oldindan
 * quradi.
 *
 * `http` rejimida slug'lar backend'dan emas, `src/content` fayllaridan olinadi (`import_content` bilan
 * bir manba): build vaqtida backend kerak emas (Vercel/CI). Fayllarda yo'q (yangi) mavzu va kitoblar
 * birinchi so'rovda on-demand ISR bilan chiqadi (`dynamicParams`). Mock rejimida mock katalog.
 */

const CHAPTER_FILE = "chapter";

/** `fan/kitob/bob/mavzu` kalitlaridan fan, kitob va mavzu id'lari (`{kitob}-{mavzu}`). */
function contentParams() {
  const subjects = new Set<string>();
  const books = new Set<string>();
  const topics: { bookId: string; topicId: string }[] = [];
  for (const key of Object.keys(CONTENT_REGISTRY)) {
    const [subject, book, , name] = key.split("/");
    subjects.add(subject);
    books.add(book);
    if (name !== CHAPTER_FILE) topics.push({ bookId: book, topicId: `${book}-${name}` });
  }
  return { subjects: [...subjects], books: [...books], topics };
}

const withLocales = <T extends object>(items: T[]) =>
  routing.locales.flatMap((locale) => items.map((item) => ({ locale, ...item })));

export async function bookStaticParams() {
  if (API_MODE === "http") {
    return withLocales(contentParams().books.map((bookId) => ({ bookId })));
  }
  const books = await getApi().getBooks();
  return withLocales(books.map((book) => ({ bookId: book.id })));
}

export async function subjectStaticParams() {
  if (API_MODE === "http") {
    return withLocales(contentParams().subjects.map((subject) => ({ subject })));
  }
  const subjects = await getApi().getSubjects();
  return withLocales(subjects.map((subject) => ({ subject: subject.slug })));
}

export async function topicStaticParams() {
  if (API_MODE === "http") return withLocales(contentParams().topics);
  const api = getApi();
  const books = (await api.getBooks()).filter((book) => book.topicsReady);
  const perBook = await Promise.all(
    books.map(async (book) => {
      const chapters = await api.getChapters(book.id);
      return chapters
        .flatMap((chapter) => chapter.topics)
        .filter((topic) => topic.ready)
        .map((topic) => ({ bookId: book.id, topicId: topic.id }));
    }),
  );
  return withLocales(perBook.flat());
}
