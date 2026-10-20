import type { BookFilters } from "@/types/catalog";
import type { ProgressFilters } from "@/types/progress";
import type { TopicSearchFilters } from "@/types/topic";

export const queryKeys = {
  grades: () => ["grades"] as const,
  subjects: () => ["subjects"] as const,
  books: (filters: BookFilters = {}) => ["books", filters] as const,
  book: (bookId: string) => ["book", bookId] as const,
  chapters: (bookId: string) => ["chapters", bookId] as const,
  topic: (topicId: string) => ["topic", topicId] as const,
  search: (query: string, filters: TopicSearchFilters = {}) => ["search", query, filters] as const,
  progress: (filters: ProgressFilters = {}) => ["progress", filters] as const,
  bookmarks: () => ["bookmarks"] as const,
  bookBookmarks: () => ["book-bookmarks"] as const,
  me: () => ["me"] as const,
  goals: () => ["goals"] as const,
  mySupport: () => ["my-support"] as const,
};
