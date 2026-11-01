"use client";

import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookX } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { BookReader } from "@/components/books/reader/BookReader";
import { BookReaderSkeleton } from "@/components/books/reader/BookReaderSkeleton";
import { RecordRecentBook } from "@/components/pdf/RecordRecentBook";
import { usePdfDocument } from "@/components/pdf/usePdfDocument";
import { TextbookActions, TextbookOverlays, useTextbookExtras } from "./TextbookExtras";
import { EmptyState } from "@/components/ui/EmptyState";
import { useBookStats } from "@/hooks/useBookStats";
import { usePdfProgress } from "@/hooks/usePdfProgress";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { flattenChapters, type ReaderSource } from "@/lib/reader/source";
import { pdfQueries } from "@/lib/pdf-books/queries";
import { pdfBookPath } from "@/lib/utils/routes";
import { useBookGuestStore } from "@/stores/book-guest.store";

const NO_PAGES: number[] = [];

/**
 * Maktab darsligini yagona o'qish oynasiga ulaydi. Hujjat, progress, statistika va «oxirgi
 * ko'rilganlar» darslik API'si orqali; chizma, belgi va yon daftar esa Kutubxona bilan bir xil
 * `/me/books/<id>/…` manzillarida. Bet xatcho'plari hozircha shu qurilmada saqlanadi.
 */
export function TextbookReader({
  bookId,
  preview = false,
  backHref,
}: {
  bookId: string;
  /** Admin oldindan ko'rishi: progress, statistika va «oxirgi ko'rilganlar» yuborilmaydi. */
  preview?: boolean;
  backHref?: string;
}) {
  const t = useTranslations("books.reader");
  const locale = useLocale() as Locale;
  const query = useQuery(pdfQueries.book(bookId));
  const book = query.data;
  const total = book?.page_count ?? 0;

  const pdf = usePdfDocument(bookId);
  const progress = usePdfProgress(bookId, total, { track: !preview });
  const guestPages = useBookGuestStore((state) => state.bookmarks[bookId]);
  const toggleGuest = useBookGuestStore((state) => state.toggleBookmark);
  const [viewed, setViewed] = useState<number | null>(null);
  useBookStats(book && !book.unverified && !preview ? bookId : undefined, viewed);

  const { doc, loading, error, reload } = pdf;
  const { ready, position, record } = progress;
  const pages = guestPages ?? NO_PAGES;
  const save = useCallback(
    (page: number) => {
      setViewed(page);
      if (!preview) record(page);
    },
    [preview, record],
  );
  const toggle = useCallback((page: number) => toggleGuest(bookId, page), [toggleGuest, bookId]);

  const offlineBook = useMemo(
    () =>
      book && !backHref
        ? {
            id: bookId,
            slug: book.slug,
            grade: book.grade,
            title: book.title,
            sizeBytes: book.size_bytes,
          }
        : null,
    [book, backHref, bookId],
  );
  const extrasProps = {
    bookId,
    title: book ? getLocalized(book.title, locale) : "",
    chapters: book?.chapters ?? [],
    doc,
    offlineBook,
  };
  const extras = useTextbookExtras(extrasProps);

  const source = ((): ReaderSource | null => {
    if (!book) return null;
    const subject = getLocalized(book.subject_title, locale);
    return {
      kind: "textbook",
      id: book.id,
      title: getLocalized(book.title, locale),
      subtitle: t("gradeSubject", { grade: book.grade, subject }),
      pageCount: book.page_count,
      chapters: flattenChapters(book.chapters),
      hasTextLayer: book.has_text_layer,
      readingMode: "standard",
      backHref: backHref ?? pdfBookPath(book),
      pdf: { doc, loading, error, reload },
      progress: { ready, lastPage: position?.page ?? null, save },
      bookmarks: { pages, toggle, isBookmarked: (page) => pages.includes(page) },
      slot: {
        actions: (context) => <TextbookActions {...extrasProps} context={context} state={extras} />,
        overlays: (context) => (
          <TextbookOverlays {...extrasProps} context={context} state={extras} />
        ),
      },
    };
  })();

  if (query.isPending) return <BookReaderSkeleton />;
  if (!source || !book) {
    return (
      <div className="bg-subtle flex h-dvh items-center justify-center p-6">
        <EmptyState icon={BookX} className="max-w-md">
          {t("notFound")}
        </EmptyState>
      </div>
    );
  }
  return (
    <>
      {!preview && !book.unverified && <RecordRecentBook book={book} />}
      <BookReader source={source} />
    </>
  );
}
