import type { QueryClient } from "@tanstack/react-query";
import { pdfKeys } from "./queries";

/** Server hali tasdiqlamagan xatcho'p amallari: `{ [kitob id]: saqlanganmi }` (optimistic qatlam). */
export type BookmarkOverrides = Record<string, boolean>;

const OVERRIDES_KEY = ["pdf-bookmarks-pending"] as const;

export const bookmarkOverridesKey = () => OVERRIDES_KEY;

export function getBookmarkOverrides(client: QueryClient): BookmarkOverrides {
  return client.getQueryData<BookmarkOverrides>(OVERRIDES_KEY) ?? {};
}

export function setBookmarkOverride(client: QueryClient, bookId: string, saved: boolean) {
  client.setQueryData<BookmarkOverrides>(OVERRIDES_KEY, {
    ...getBookmarkOverrides(client),
    [bookId]: saved,
  });
}

export function clearBookmarkOverride(client: QueryClient, bookId: string) {
  const rest = { ...getBookmarkOverrides(client) };
  delete rest[bookId];
  client.setQueryData<BookmarkOverrides>(OVERRIDES_KEY, rest);
}

/** Yozuv serverga o'tgach: o'qish ma'lumotidan hosil bo'lgan ro'yxatlar yangilanadi. */
export function invalidateReadingData(client: QueryClient) {
  return Promise.all([
    client.invalidateQueries({ queryKey: pdfKeys.allProgress() }),
    client.invalidateQueries({ queryKey: pdfKeys.library() }),
    client.invalidateQueries({ queryKey: pdfKeys.dashboard() }),
    client.invalidateQueries({ queryKey: pdfKeys.results() }),
    client.invalidateQueries({ queryKey: pdfKeys.bookmarks() }),
  ]);
}
