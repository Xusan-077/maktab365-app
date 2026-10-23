"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ListTree } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { usePdfProgress } from "@/hooks/usePdfProgress";
import { ApiError } from "@/lib/api/types";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { Link, usePathname, useRouter } from "@/lib/i18n/navigation";
import { clampPage, parsePageParam } from "@/lib/pdf/page-nav";
import { parseSlidesParams, readSlidesProgress, withSlidesParams } from "@/lib/pdf/slides";
import { flattenToc } from "@/lib/pdf/toc";
import { swipeDirection } from "@/lib/pdf/swipe";
import { pdfQueries } from "@/lib/pdf-books/queries";
import { pdfBookPath, ROUTES } from "@/lib/utils/routes";
import { ReportErrorLink } from "@/components/support/ReportErrorLink";
import { BookCover } from "./BookCover";
import { PdfBookDescription } from "./PdfBookDescription";
import { RecordRecentBook } from "./RecordRecentBook";
import { PdfBookmarkButton } from "./PdfBookmarkButton";
import { PdfPageCanvas } from "./PdfPageCanvas";
import { PdfSlidesViewer } from "./PdfSlidesViewer";
import { PdfToolbar } from "./PdfToolbar";
import { PdfTocDrawer } from "./PdfTocDrawer";
import { usePdfDocument } from "./usePdfDocument";

const isTypingTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/** Imzolangan URL muddati tugagach birinchi xatoda yangi URL bilan hujjat qayta ochiladi. */
const MAX_AUTO_RELOADS = 1;

function ReaderMessage({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 py-8">
      <p className="text-danger">{message}</p>
      {action}
    </div>
  );
}

/**
 * PDF darslik o'qish oynasi: bir vaqtda faqat ko'rinayotgan sahifa chiziladi. Sahifa URL'da
 * (`?page=12`), tugmalar/raqam maydoni/←→/swipe bilan o'tiladi, oxirgi sahifa eslab qolinadi.
 */
export function PdfReader({ bookId }: { bookId: string }) {
  const t = useTranslations("pdfBooks.reader");
  const tt = useTranslations("pdfBooks.toc");
  const tc = useTranslations("pdfBooks.card");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const book = useQuery(pdfQueries.book(bookId));
  const total = book.data?.page_count ?? 0;
  const progress = usePdfProgress(bookId, total);
  const document = usePdfDocument(bookId);
  const [renderFailed, setRenderFailed] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  const reloads = useRef(0);

  const rawPage = searchParams.get("page");
  const urlPage = total > 0 ? parsePageParam(rawPage, total) : null;
  // URL > saqlangan pozitsiya > 1. Pozitsiya aniqlanguncha `null`.
  const page = total === 0 ? null : (urlPage ?? (progress.ready ? progress.resume : null));

  // Boshqa parametrlar (`slides`, `slide`) saqlanadi: sahifa almashganda ko'rgich yopilmaydi.
  const replaceQuery = useCallback(
    (patch: Parameters<typeof withSlidesParams>[1]) =>
      router.replace(`${pathname}?${withSlidesParams(searchParams, patch)}`, { scroll: false }),
    [router, pathname, searchParams],
  );
  const setPageInUrl = useCallback((next: number) => replaceQuery({ page: next }), [replaceQuery]);

  // Prezentatsiya: `?slides=<bo'lim id>&slide=N`; faqat prezentatsiyasi bor bo'lim ochiladi.
  const slidesParams = parseSlidesParams(searchParams);
  const slidesItem = useMemo(
    () =>
      slidesParams.chapterId
        ? flattenToc(book.data?.chapters ?? []).find(
            (item) => item.id === slidesParams.chapterId && item.slides,
          )
        : undefined,
    [slidesParams.chapterId, book.data],
  );
  const slidesOpen = Boolean(slidesItem);
  const slideNumber = slidesParams.slide;
  const openSlides = useCallback(
    (chapterId: string, startSlide: number) =>
      replaceQuery({ slides: chapterId, slide: startSlide }),
    [replaceQuery],
  );
  const setSlide = useCallback((next: number) => replaceQuery({ slide: next }), [replaceQuery]);
  const closeSlides = useCallback(
    () => replaceQuery({ slides: null, slide: null }),
    [replaceQuery],
  );
  const backToBook = useCallback(
    () => replaceQuery({ slides: null, slide: null, page: slidesItem?.page ?? null }),
    [replaceQuery, slidesItem],
  );
  // Havola ulashilganda: slayd aytilmagan bo'lsa oxirgi ko'rilgan (yoki 1); yaroqsiz bo'lim — yopiladi.
  const slidesChapterId = slidesParams.chapterId;
  useEffect(() => {
    if (!slidesChapterId || !book.data) return;
    if (!slidesOpen) {
      replaceQuery({ slides: null, slide: null });
    } else if (slideNumber === null) {
      replaceQuery({ slide: readSlidesProgress(slidesChapterId) ?? 1 });
    }
  }, [slidesChapterId, slidesOpen, slideNumber, book.data, replaceQuery]);

  // URL'ni haqiqiy sahifaga keltiradi (saqlangan pozitsiya, 1..N ga tuzatilgan qiymat).
  useEffect(() => {
    if (page !== null && rawPage !== String(page)) setPageInUrl(page);
  }, [page, rawPage, setPageInUrl]);

  // Joriy sahifani eslab qoladi (saqlangan bilan bir xil bo'lsa qayta yozilmaydi).
  const savedPage = progress.position?.page;
  const { record } = progress;
  useEffect(() => {
    if (page !== null && progress.ready && page !== savedPage) record(page);
  }, [page, progress.ready, savedPage, record]);

  const goTo = useCallback(
    (next: number) => {
      if (total > 0) setPageInUrl(clampPage(next, total));
    },
    [total, setPageInUrl],
  );

  useEffect(() => {
    if (page === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      if (isTypingTarget(event.target)) return;
      if (event.key === "ArrowLeft" && page > 1) {
        event.preventDefault();
        goTo(page - 1);
      } else if (event.key === "ArrowRight" && page < total) {
        event.preventDefault();
        goTo(page + 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [page, total, goTo]);

  const touch = useRef<{ x: number; y: number; at: number } | null>(null);
  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType === "mouse") return;
    touch.current = { x: event.clientX, y: event.clientY, at: event.timeStamp };
  };
  const onPointerUp = (event: PointerEvent) => {
    const start = touch.current;
    touch.current = null;
    if (!start || page === null) return;
    const direction = swipeDirection(
      event.clientX - start.x,
      event.clientY - start.y,
      event.timeStamp - start.at,
    );
    if (direction === "next" && page < total) goTo(page + 1);
    if (direction === "prev" && page > 1) goTo(page - 1);
  };

  const retry = () => {
    reloads.current = 0;
    setRenderFailed(false);
    document.reload();
  };
  const onRenderError = () => {
    if (reloads.current < MAX_AUTO_RELOADS) {
      reloads.current += 1;
      document.reload();
    } else {
      setRenderFailed(true);
    }
  };

  if (book.error) {
    const notFound = book.error instanceof ApiError && book.error.status === 404;
    return (
      <ReaderMessage
        message={t(notFound ? "notFound" : "loadError")}
        action={
          notFound ? (
            <Link href={ROUTES.textbooks} className="text-link underline">
              {t("back")}
            </Link>
          ) : (
            <Button variant="secondary" onClick={() => void book.refetch()}>
              {t("retry")}
            </Button>
          )
        }
      />
    );
  }

  const title = book.data ? getLocalized(book.data.title, locale) : "";
  const chapters = book.data?.chapters ?? [];

  return (
    <div className="flex flex-col gap-3" data-testid="pdf-reader">
      <RecordRecentBook book={book.data && !book.data.unverified ? book.data : undefined} />
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={book.data ? pdfBookPath(book.data) : ROUTES.textbooks}
          className="text-link inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t("back")}
        </Link>
        {book.data && (
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <BookCover
              grade={book.data.grade}
              subject={book.data.subject}
              subjectTitle={getLocalized(book.data.subject_title, locale)}
              src={book.data.cover}
              className="hidden w-9 sm:block"
            />
            <div className="min-w-0">
              <h1 className="truncate text-lg leading-tight font-semibold">{title}</h1>
              <p className="text-muted truncate text-sm">
                {tc("meta", {
                  grade: book.data.grade,
                  subject: getLocalized(book.data.subject_title, locale),
                })}
              </p>
            </div>
          </div>
        )}
        {chapters.length > 0 && (
          <Button variant="secondary" data-testid="pdf-toc-open" onClick={() => setTocOpen(true)}>
            <ListTree className="size-4" aria-hidden />
            {tt("button")}
          </Button>
        )}
        {book.data && <PdfBookmarkButton bookId={bookId} />}
      </div>
      {book.data?.description && <PdfBookDescription text={book.data.description} />}

      <div className="bg-background sticky top-0 z-10 -mx-4 px-4 py-2 sm:-mx-6 sm:px-6">
        {page !== null && total > 0 ? (
          <PdfToolbar page={page} total={total} onGo={goTo} />
        ) : (
          <Skeleton className="mx-auto h-10 w-56" />
        )}
      </div>

      <div
        className="touch-pan-y select-none"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (touch.current = null)}
      >
        {document.error && !document.doc ? (
          <ReaderMessage
            message={t("loadError")}
            action={
              <Button variant="secondary" onClick={retry}>
                {t("retry")}
              </Button>
            }
          />
        ) : renderFailed ? (
          <ReaderMessage
            message={t("pageError")}
            action={
              <Button variant="secondary" onClick={retry}>
                {t("retry")}
              </Button>
            }
          />
        ) : document.doc && page !== null ? (
          <PdfPageCanvas
            doc={document.doc}
            pageNumber={page}
            label={t("position", { page, total })}
            onRendered={() => (reloads.current = 0)}
            onError={onRenderError}
          />
        ) : (
          <div role="status" aria-label={t("loading")}>
            <Skeleton className="mx-auto aspect-[1/1.4] w-full max-w-3xl" />
          </div>
        )}
      </div>

      {chapters.length > 0 && page !== null && (
        <PdfTocDrawer
          open={tocOpen}
          onOpenChange={setTocOpen}
          chapters={chapters}
          page={page}
          onGo={goTo}
          onOpenSlides={openSlides}
        />
      )}

      {slidesItem?.slides && slidesParams.chapterId && slideNumber !== null && (
        <PdfSlidesViewer
          key={slidesParams.chapterId}
          bookId={bookId}
          chapterId={slidesParams.chapterId}
          title={slidesItem.title}
          slideCount={slidesItem.slides.page_count}
          slide={slideNumber}
          onSlide={setSlide}
          onClose={closeSlides}
          onBackToBook={backToBook}
        />
      )}

      {book.data && <ReportErrorLink topicId={bookId} />}
    </div>
  );
}
