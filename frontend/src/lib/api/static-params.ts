import { routing } from "@/lib/i18n/routing";
import { getApi } from "./index";

/** `generateStaticParams` uchun umumiy ro'yxatlar: marketing va panel sahifalari bir xil yo'llarni oldindan quradi. */
export async function bookStaticParams() {
  const books = await getApi().getBooks();
  return routing.locales.flatMap((locale) => books.map((book) => ({ locale, bookId: book.id })));
}

export async function subjectStaticParams() {
  const subjects = await getApi().getSubjects();
  return routing.locales.flatMap((locale) =>
    subjects.map((subject) => ({ locale, subject: subject.slug })),
  );
}

export async function topicStaticParams() {
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
  return routing.locales.flatMap((locale) => perBook.flat().map((ids) => ({ locale, ...ids })));
}
