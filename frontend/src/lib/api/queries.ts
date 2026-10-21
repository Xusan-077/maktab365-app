import { queryOptions } from "@tanstack/react-query";
import type { BookFilters } from "@/types/catalog";
import type { TopicSearchFilters } from "@/types/topic";
import { getApi } from "./index";
import { queryKeys } from "./query-keys";

export const SEARCH_MIN_LENGTH = 2;

/** Hook'lar ham, server prefetch ham shu opsiyalardan foydalanadi (kalit va fetcher bir joyda). */
export const apiQueries = {
  grades: () => queryOptions({ queryKey: queryKeys.grades(), queryFn: () => getApi().getGrades() }),
  subjects: () =>
    queryOptions({ queryKey: queryKeys.subjects(), queryFn: () => getApi().getSubjects() }),
  books: (filters: BookFilters = {}) =>
    queryOptions({ queryKey: queryKeys.books(filters), queryFn: () => getApi().getBooks(filters) }),
  book: (bookId: string) =>
    queryOptions({ queryKey: queryKeys.book(bookId), queryFn: () => getApi().getBook(bookId) }),
  chapters: (bookId: string) =>
    queryOptions({
      queryKey: queryKeys.chapters(bookId),
      queryFn: () => getApi().getChapters(bookId),
    }),
  topic: (topicId: string) =>
    queryOptions({ queryKey: queryKeys.topic(topicId), queryFn: () => getApi().getTopic(topicId) }),
  search: (query: string, filters: TopicSearchFilters = {}) =>
    queryOptions({
      queryKey: queryKeys.search(query, filters),
      queryFn: () => getApi().searchTopics(query, filters),
      enabled: query.trim().length >= SEARCH_MIN_LENGTH,
    }),
  progress: () =>
    queryOptions({ queryKey: queryKeys.progress(), queryFn: () => getApi().getProgress() }),
  bookmarks: () =>
    queryOptions({ queryKey: queryKeys.bookmarks(), queryFn: () => getApi().getBookmarks() }),
  bookBookmarks: () =>
    queryOptions({
      queryKey: queryKeys.bookBookmarks(),
      queryFn: () => getApi().getBookBookmarks(),
    }),
  me: () => queryOptions({ queryKey: queryKeys.me(), queryFn: () => getApi().getMe() }),
  goals: () => queryOptions({ queryKey: queryKeys.goals(), queryFn: () => getApi().getGoals() }),
  dashboard: () =>
    queryOptions({ queryKey: queryKeys.dashboard(), queryFn: () => getApi().getDashboard() }),
  results: () =>
    queryOptions({ queryKey: queryKeys.results(), queryFn: () => getApi().getResults() }),
  recent: () => queryOptions({ queryKey: queryKeys.recent(), queryFn: () => getApi().getRecent() }),
  teacherDashboard: () =>
    queryOptions({
      queryKey: queryKeys.teacherDashboard(),
      queryFn: () => getApi().getTeacherDashboard(),
    }),
  mySupport: () =>
    queryOptions({ queryKey: queryKeys.mySupport(), queryFn: () => getApi().getMySupport() }),
};
