"use client";

import { useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { getMyBooksApi, type PageEntry, type PageEntryList } from "@/lib/books/api";
import { isEntryEmpty, withHighlightColor, recolorHighlight } from "@/lib/books/entries";
import { bookKeys } from "@/lib/books/queries";

type EntriesCache = InfiniteData<PageEntryList, number>;
type Snapshot = [readonly unknown[], EntriesCache | undefined][];

const isSame = (entry: PageEntry, bookId: string, page: number) =>
  entry.book.id === bookId && entry.page === page;

/** Barcha ro'yxat keshlarida (har xil filtr) bitta yozuvni o'zgartiradi; bo'sh qolsa olib tashlaydi. */
function patchEntries(
  client: ReturnType<typeof useQueryClient>,
  bookId: string,
  page: number,
  patch: (entry: PageEntry) => PageEntry | null,
): Snapshot {
  const snapshot = client.getQueriesData<EntriesCache>({ queryKey: bookKeys.entriesRoot() });
  client.setQueriesData<EntriesCache>({ queryKey: bookKeys.entriesRoot() }, (old) => {
    if (!old || !("pages" in old)) return old;
    return {
      ...old,
      pages: old.pages.map((chunk) => {
        const results = chunk.results.flatMap((entry) => {
          if (!isSame(entry, bookId, page)) return [entry];
          const next = patch(entry);
          return next && !isEmpty(next) ? [next] : [];
        });
        return { ...chunk, results, count: chunk.count - (chunk.results.length - results.length) };
      }),
    };
  });
  return snapshot;
}

const isEmpty = (entry: PageEntry) => isEntryEmpty(entry);

/** O'qish oynasi va yon daftar keshlari ro'yxatdagi o'zgarishdan keyin eskirmasin. */
function invalidateReaderCaches(client: ReturnType<typeof useQueryClient>, bookId: string) {
  void client.invalidateQueries({ queryKey: ["books", "annotations", bookId] });
  void client.invalidateQueries({ queryKey: ["books", "note", bookId] });
  void client.invalidateQueries({ queryKey: bookKeys.bookmarks(bookId) });
  void client.invalidateQueries({ queryKey: bookKeys.entriesRoot() });
}

function restore(client: ReturnType<typeof useQueryClient>, snapshot: Snapshot | undefined) {
  for (const [key, data] of snapshot ?? []) client.setQueryData(key, data);
}

/** Yozuvni o'chirish va belgilash rangini almashtirish: optimistik, xatoda qaytariladi. */
export function useEntryMutations() {
  const client = useQueryClient();

  const remove = useMutation({
    mutationFn: async ({ entry }: { entry: PageEntry }) => {
      const api = getMyBooksApi();
      const { id } = entry.book;
      await api.savePageAnnotations(id, entry.page, []);
      if (entry.note.trim() !== "") await api.saveNote(id, entry.page, "");
      if (entry.bookmarked) await api.removeBookmark(id, entry.page);
    },
    onMutate: async ({ entry }) => {
      await client.cancelQueries({ queryKey: bookKeys.entriesRoot() });
      return { snapshot: patchEntries(client, entry.book.id, entry.page, () => null) };
    },
    onError: (_error, _vars, context) => restore(client, context?.snapshot),
    onSettled: (_data, _error, { entry }) => invalidateReaderCaches(client, entry.book.id),
  });

  const recolor = useMutation({
    mutationFn: async ({
      entry,
      annotationId,
      color,
    }: {
      entry: PageEntry;
      annotationId: string;
      color: string;
    }) => {
      const current = entry.annotations.find((item) => item.id === annotationId);
      await getMyBooksApi().updateAnnotation(
        entry.book.id,
        annotationId,
        recolorHighlight(current?.data, color),
      );
    },
    onMutate: async ({ entry, annotationId, color }) => {
      await client.cancelQueries({ queryKey: bookKeys.entriesRoot() });
      return {
        snapshot: patchEntries(client, entry.book.id, entry.page, (item) =>
          withHighlightColor(item, annotationId, color),
        ),
      };
    },
    onError: (_error, _vars, context) => restore(client, context?.snapshot),
    onSettled: (_data, _error, { entry }) => invalidateReaderCaches(client, entry.book.id),
  });

  return { remove, recolor };
}
