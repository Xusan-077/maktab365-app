import { CONTENT_REGISTRY } from "@/content/registry";
import type { Chapter, TopicSummary } from "@/types/catalog";
import type { ChapterFile, TopicFile } from "@/types/content";
import type { Topic } from "@/types/topic";

/** Bob fayli nomi (`.../{bob}/chapter.json`); qolgan fayllar — mavzular. */
const CHAPTER_FILE = "chapter";

interface ContentLocation {
  bookId: string;
  chapterDir: string;
  name: string;
}

function locate(key: string): ContentLocation {
  const [, bookId, chapterDir, name] = key.split("/");
  return { bookId, chapterDir, name };
}

const entries = Object.entries(CONTENT_REGISTRY).map(([key, data]) => ({
  ...locate(key),
  data,
}));

/** Boblar va mavzular `src/content` dagi JSON fayllardan olinadi (mock ma'lumot ikki joyda takrorlanmaydi). */
const chapterEntries = entries
  .filter((entry) => entry.name === CHAPTER_FILE)
  .map((entry) => ({ ...entry, file: entry.data as ChapterFile }));

const topicEntries = entries
  .filter((entry) => entry.name !== CHAPTER_FILE)
  .map((entry) => ({ ...entry, file: entry.data as TopicFile }));

const chapterId = (bookId: string, order: number) => `${bookId}-ch${order}`;
const byOrder = <T extends { order: number }>(a: T, b: T) => a.order - b.order;

export const TOPICS: Topic[] = chapterEntries
  .flatMap(({ bookId, chapterDir, file: chapter }) =>
    topicEntries
      .filter((topic) => topic.bookId === bookId && topic.chapterDir === chapterDir)
      .map(({ name, file }) => ({
        id: `${bookId}-${name}`,
        bookId,
        chapterId: chapterId(bookId, chapter.order),
        order: file.order,
        title: file.title,
        ready: file.blocks.length > 0,
        status: file.status,
        blocks: file.blocks,
      })),
  )
  .sort((a, b) => a.chapterId.localeCompare(b.chapterId) || byOrder(a, b));

export const CHAPTERS: Chapter[] = chapterEntries
  .map(({ bookId, file }): Chapter => {
    const id = chapterId(bookId, file.order);
    const topics: TopicSummary[] = TOPICS.filter((topic) => topic.chapterId === id).map(
      (topic) => ({
        id: topic.id,
        bookId: topic.bookId,
        chapterId: topic.chapterId,
        order: topic.order,
        title: topic.title,
        ready: topic.ready,
      }),
    );
    return { id, bookId, order: file.order, title: file.title, topics };
  })
  .sort((a, b) => a.bookId.localeCompare(b.bookId) || byOrder(a, b));
