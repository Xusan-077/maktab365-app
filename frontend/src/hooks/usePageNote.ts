"use client";

import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getAnnotationQueue, requestAnnotationFlush } from "@/lib/books/annotation-sync";
import { NOTE_MAX_LENGTH } from "@/lib/books/annotations";
import type { PageNote } from "@/lib/books/api";
import { bookKeys, bookQueries } from "@/lib/books/queries";
import { useAuth } from "./useAuth";

/**
 * Betning yon daftar matni. Boshlang'ich qiymat: navbatdagi (yuborilmagan) matn, bo'lmasa server.
 * Yozilganda navbatga darhol tushadi (brauzerga saqlanadi), serverga debounce bilan ketadi.
 * Betni almashtirganda `key={page}` bilan qayta yaratiladi.
 */
export function usePageNote(bookId: string, page: number) {
  const { signedIn, sessionUser } = useAuth();
  const userId = signedIn ? (sessionUser?.id ?? null) : null;
  const queryClient = useQueryClient();
  const query = useQuery({ ...bookQueries.note(bookId, page), enabled: signedIn });
  const [draft, setDraft] = useState<string | null>(null);

  const queued = userId ? getAnnotationQueue(userId).find("note", bookId, page) : undefined;
  const text = draft ?? queued?.text ?? query.data?.text ?? "";

  const setText = useCallback(
    (value: string) => {
      const next = value.slice(0, NOTE_MAX_LENGTH);
      setDraft(next);
      if (!userId) return;
      const at = new Date().toISOString();
      getAnnotationQueue(userId).enqueue({ kind: "note", bookId, page, text: next, at });
      queryClient.setQueryData<PageNote>(bookKeys.note(bookId, page), {
        page,
        text: next,
        updated_at: at,
      });
      requestAnnotationFlush();
    },
    [userId, bookId, page, queryClient],
  );

  return {
    text,
    setText,
    ready: !signedIn || draft !== null || queued !== undefined || query.isSuccess,
    error: signedIn && query.isError && queued === undefined,
    retry: () => void query.refetch(),
  };
}
