import type { components } from "./schema";
import { GRADES, type Book, type Chapter, type Grade, type Subject } from "@/types/catalog";
import type { Topic, TopicBlock, TopicSearchResult } from "@/types/topic";

type Schemas = components["schemas"];

/**
 * Backend (slug'lar) → frontend modeli (id'lar). http rejimida id'lar slug'lardan yasaladi:
 * fan `id = slug`, kitob `id = slug` (`algebra-9`), bob `{kitob}-ch{order}`, mavzu `{kitob}-{slug}`.
 */
export const topicIdOf = (bookSlug: string, topicSlug: string) => `${bookSlug}-${topicSlug}`;
export const chapterIdOf = (bookSlug: string, order: number) => `${bookSlug}-ch${order}`;

/** Mavzu id'sidan (`{kitob}-{slug}`) mavzu slug'i; kitob id'si ma'lum bo'lsa. */
export const topicSlugOf = (bookSlug: string, topicId: string) =>
  topicId.startsWith(`${bookSlug}-`) ? topicId.slice(bookSlug.length + 1) : null;

const toGrade = (value: number): Grade => {
  if (!(GRADES as readonly number[]).includes(value))
    throw new RangeError(`Noto'g'ri sinf: ${value}`);
  return value as Grade;
};

export function toSubject(subject: Schemas["Subject"]): Subject {
  return { id: subject.slug, slug: subject.slug, name: subject.title };
}

export function toBook(book: Schemas["Book"] | Schemas["BookDetail"]): Book {
  return {
    id: book.slug,
    title: book.title,
    grade: toGrade(book.grade),
    subjectId: book.subject,
    author: book.author,
    ...(book.cover && { coverUrl: book.cover }),
    publishedYear: book.year,
    edition: book.edition,
    ...(book.pdf && { pdfUrl: book.pdf }),
    topicsReady: book.topics_ready,
  };
}

export function toChapters(book: Schemas["BookDetail"]): Chapter[] {
  return book.chapters.map((chapter) => ({
    id: chapterIdOf(book.slug, chapter.order),
    bookId: book.slug,
    order: chapter.order,
    title: chapter.title,
    topics: chapter.topics.map((topic) => ({
      id: topicIdOf(book.slug, topic.slug),
      bookId: book.slug,
      chapterId: chapterIdOf(book.slug, chapter.order),
      order: topic.order,
      title: topic.title,
      ready: true,
    })),
  }));
}

/** `unverified` (draft/reviewed, hali nashr qilinmagan) — "Tekshiruvdan o'tmagan" belgisi. */
export function toTopic(topic: Schemas["TopicDetail"]): Topic {
  const { book, breadcrumb } = topic;
  return {
    id: topicIdOf(book, topic.slug),
    bookId: book,
    chapterId: chapterIdOf(book, breadcrumb.chapter.order),
    order: topic.order,
    title: topic.title,
    ready: true,
    status: topic.unverified ? "draft" : "reviewed",
    blocks: topic.blocks as unknown as TopicBlock[],
  };
}

export function toSearchResult(result: Schemas["SearchResult"]): TopicSearchResult {
  const { book, topic } = result;
  return {
    topic: {
      id: topicIdOf(book.slug, topic.slug),
      bookId: book.slug,
      chapterId: chapterIdOf(book.slug, result.chapter_order),
      order: topic.order,
      title: topic.title,
      ready: true,
    },
    bookTitle: book.title,
    chapterTitle: result.chapter_title,
    snippet: result.snippet,
  };
}
