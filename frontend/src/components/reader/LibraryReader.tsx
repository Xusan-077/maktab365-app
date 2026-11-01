"use client";

import { useMemo } from "react";
import { BookReader } from "@/components/books/reader/BookReader";
import { useLibraryBookDocument } from "@/components/pdf/usePdfDocument";
import { useBookBookmarks } from "@/hooks/useBookBookmarks";
import { useBookProgress } from "@/hooks/useBookProgress";
import type { BookDetail } from "@/lib/books/api";
import type { ReaderSource } from "@/lib/reader/source";
import { bookPath } from "@/lib/utils/routes";

/** Kutubxona kitobini yagona o'qish oynasiga ulaydi (hujjat, progress va xatcho'plar — `Book` API'si). */
export function LibraryReader({ book }: { book: BookDetail }) {
  const pdf = useLibraryBookDocument(book.id);
  const progress = useBookProgress(book.id);
  const bookmarks = useBookBookmarks(book.id);
  const { doc, loading, error } = pdf;
  const { reload } = pdf;
  const { ready, lastPage, save } = progress;
  const { pages, toggle } = bookmarks;

  const source = useMemo<ReaderSource>(
    () => ({
      kind: "library",
      id: book.id,
      title: book.title,
      subtitle: book.author || null,
      pageCount: book.page_count,
      chapters: book.chapters,
      hasTextLayer: book.has_text_layer,
      readingMode: book.reading_mode,
      backHref: bookPath(book.slug),
      pdf: { doc, loading, error, reload },
      progress: { ready, lastPage, save },
      bookmarks: { pages, toggle, isBookmarked: (page) => pages.includes(page) },
    }),
    [book, doc, loading, error, reload, ready, lastPage, save, pages, toggle],
  );

  return <BookReader source={source} />;
}
