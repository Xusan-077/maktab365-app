"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ListTree } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useBookStats } from "@/hooks/useBookStats";
import { useFullscreen } from "@/hooks/useFullscreen";
import { usePdfAnnotations } from "@/hooks/usePdfAnnotations";
import { usePdfProgress } from "@/hooks/usePdfProgress";
import { ApiError } from "@/lib/api/types";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { Link, usePathname, useRouter } from "@/lib/i18n/navigation";
import {
  annotationsOnPage,
  newAnnotation,
  type Annotation,
  type AnnotationColor,
  type AnnotationRect,
} from "@/lib/pdf/annotations";
import { clampPage, parsePageParam } from "@/lib/pdf/page-nav";
import { isDoubleTap, nextZoom, type ReaderZoom, type TapPoint } from "@/lib/pdf/reader-prefs";
import { parseSlidesParams, readSlidesProgress, withSlidesParams } from "@/lib/pdf/slides";
import { flattenToc } from "@/lib/pdf/toc";
import { swipeDirection } from "@/lib/pdf/swipe";
import { pdfQueries } from "@/lib/pdf-books/queries";
import { cn } from "@/lib/utils/cn";
import { pdfBookPath, ROUTES } from "@/lib/utils/routes";
import { useReaderPrefsStore } from "@/stores/reader-prefs.store";
import { ReportErrorLink } from "@/components/support/ReportErrorLink";
import { BookCover } from "./BookCover";
import { PdfBookDescription } from "./PdfBookDescription";
import { RecordRecentBook } from "./RecordRecentBook";
import { PdfBookmarkButton } from "./PdfBookmarkButton";
import { AnnotationDialog } from "./AnnotationDialog";
import { AnnotationLayer } from "./AnnotationLayer";
import { AnnotationsListDialog } from "./AnnotationsListDialog";
import { PdfFindDialog } from "./PdfFindDialog";
import { PdfPageCanvas } from "./PdfPageCanvas";
import { PdfReaderControls } from "./PdfReaderControls";
import { ReaderShortcutsDialog } from "./ReaderShortcutsDialog";
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
export function PdfReader({ bookId, backHref }: { bookId: string; backHref?: string }) {
  const t = useTranslations("pdfBooks.reader");
  const tt = useTranslations("pdfBooks.toc");
  const tc = useTranslations("pdfBooks.card");
  const tf = useTranslations("pdfBooks.find");
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
  const stageRef = useRef<HTMLDivElement>(null);
  const tone = useReaderPrefsStore((state) => state.tone);
  const fit = useReaderPrefsStore((state) => state.fit);
  const cycleTone = useReaderPrefsStore((state) => state.cycleTone);
  const toggleFit = useReaderPrefsStore((state) => state.toggleFit);
  const [zoom, setZoom] = useState<ReaderZoom>(1);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const annotations = usePdfAnnotations(bookId);
  const [drawing, setDrawing] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  // Dialog: yangi belgi (chizilgan to'rtburchak) yoki mavjudini tahrirlash.
  const [draft, setDraft] = useState<
    { kind: "new"; rect: AnnotationRect } | { kind: "edit"; annotation: Annotation } | null
  >(null);
  const [lastColor, setLastColor] = useState<AnnotationColor>("yellow");
  const findTerm = (searchParams.get("find") ?? "").trim().slice(0, 80);
  const fullscreen = useFullscreen(stageRef);
  const toggleFullscreen = fullscreen.toggle;

  useEffect(() => {
    void useReaderPrefsStore.persist.rehydrate();
  }, []);

  const rawPage = searchParams.get("page");
  const urlPage = total > 0 ? parsePageParam(rawPage, total) : null;
  // URL > saqlangan pozitsiya > 1. Pozitsiya aniqlanguncha `null`.
  const page = total === 0 ? null : (urlPage ?? (progress.ready ? progress.resume : null));
  // Admin oldindan ko'rishi (`backHref`) statistika va "oxirgi ko'rilganlar"ga yozilmaydi.
  const counted = book.data && !book.data.unverified && !backHref;
  useBookStats(counted ? bookId : undefined, page);

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
      // Ctrl/⌘+F: sahifa canvas bo'lgani uchun brauzer qidiruvi foydasiz — kitob ichida qidirish ochiladi.
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "f") {
        if (window.document.querySelector("dialog[open]")) return;
        event.preventDefault();
        setFindOpen(true);
        return;
      }
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      if (isTypingTarget(event.target)) return;
      if (event.key === "ArrowLeft" && page > 1) {
        event.preventDefault();
        goTo(page - 1);
      } else if (event.key === "ArrowRight" && page < total) {
        event.preventDefault();
        goTo(page + 1);
      }
      // Qolgan yorliqlar ochiq dialog (mundarija, prezentatsiya, yordam) ustida ishlamaydi.
      if (window.document.querySelector("dialog[open]")) return;
      const key = event.key.toLowerCase();
      if (event.key === "Home" && page > 1) {
        event.preventDefault();
        goTo(1);
      } else if (event.key === "End" && page < total) {
        event.preventDefault();
        goTo(total);
      } else if (key === "f") {
        event.preventDefault();
        toggleFullscreen();
      } else if (key === "t") {
        cycleTone();
      } else if (key === "z") {
        setZoom(nextZoom);
      } else if (event.key === "?") {
        event.preventDefault();
        setShortcutsOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [page, total, goTo, toggleFullscreen, cycleTone]);

  const touch = useRef<{ x: number; y: number; at: number } | null>(null);
  const lastTap = useRef<TapPoint | null>(null);
  const onPointerDown = (event: PointerEvent) => {
    touch.current = { x: event.clientX, y: event.clientY, at: event.timeStamp };
  };
  const onPointerUp = (event: PointerEvent) => {
    const start = touch.current;
    touch.current = null;
    if (!start || page === null) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    // Ikki marta bosish (sichqoncha ham, barmoq ham) — zoom 1× ↔ 2×.
    if (Math.hypot(dx, dy) < 10) {
      const tap = { x: event.clientX, y: event.clientY, at: event.timeStamp };
      if (isDoubleTap(lastTap.current, tap)) {
        lastTap.current = null;
        setZoom(nextZoom);
      } else {
        lastTap.current = tap;
      }
      return;
    }
    // Swipe faqat barmoq bilan va kattalashtirilmagan sahifada (kattalashganda surish — scroll).
    if (event.pointerType === "mouse" || zoom > 1) return;
    const direction = swipeDirection(dx, dy, event.timeStamp - start.at);
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
      <RecordRecentBook book={counted ? book.data : undefined} />
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={backHref ?? (book.data ? pdfBookPath(book.data) : ROUTES.textbooks)}
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

      <div
        ref={stageRef}
        data-tone={tone}
        data-testid="pdf-stage"
        className={cn("pdf-stage flex flex-col gap-3", fullscreen.active && "overflow-auto p-4")}
      >
        <div className="bg-background sticky top-0 z-10 -mx-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 py-2 sm:-mx-6 sm:px-6">
          {page !== null && total > 0 ? (
            <PdfToolbar page={page} total={total} onGo={goTo} />
          ) : (
            <Skeleton className="h-10 w-56" />
          )}
          <PdfReaderControls
            tone={tone}
            fit={fit}
            zoom={zoom}
            fullscreen={fullscreen.active}
            fullscreenSupported={fullscreen.supported}
            onTone={cycleTone}
            onFit={toggleFit}
            onZoom={() => setZoom(nextZoom)}
            onFullscreen={toggleFullscreen}
            onShortcuts={() => setShortcutsOpen(true)}
            onSearch={document.doc ? () => setFindOpen(true) : undefined}
            drawing={drawing}
            onDrawing={document.doc ? () => setDrawing((value) => !value) : undefined}
            annotationCount={annotations.items.length}
            onAnnotations={() => setListOpen(true)}
          />
        </div>

        {findTerm && (
          <div
            className="flex items-center justify-center gap-2 text-sm"
            data-testid="pdf-find-chip"
          >
            <span className="text-muted">{tf("highlighted", { term: findTerm })}</span>
            <button
              type="button"
              onClick={() => replaceQuery({ find: null })}
              className="text-link min-h-11 underline underline-offset-4"
            >
              {tf("clear")}
            </button>
          </div>
        )}

        <div
          className={cn(
            "pdf-page-area select-none",
            zoom > 1 ? "touch-pan-x touch-pan-y" : "touch-pan-y",
          )}
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
            <div className={cn(zoom > 1 && "overflow-x-auto")}>
              <div
                style={{
                  width: `${zoom * 100}%`,
                  height:
                    fit === "page" && zoom === 1
                      ? fullscreen.active
                        ? "calc(100dvh - 7rem)"
                        : "calc(100dvh - 9rem)"
                      : undefined,
                }}
                className={cn(fit === "page" && zoom === 1 && "min-h-80")}
              >
                <PdfPageCanvas
                  doc={document.doc}
                  pageNumber={page}
                  label={t("position", { page, total })}
                  fit={fit === "page" && zoom === 1 ? "contain" : "width"}
                  highlight={findTerm || undefined}
                  overlay={
                    <AnnotationLayer
                      annotations={annotationsOnPage(annotations.items, page)}
                      drawing={drawing}
                      onDraw={(rect) => setDraft({ kind: "new", rect })}
                      onSelect={(annotation) => setDraft({ kind: "edit", annotation })}
                    />
                  }
                  onRendered={() => (reloads.current = 0)}
                  onError={onRenderError}
                />
              </div>
            </div>
          ) : (
            <div role="status" aria-label={t("loading")}>
              <Skeleton className="mx-auto aspect-[1/1.4] w-full max-w-3xl" />
            </div>
          )}
        </div>
      </div>

      {draft && page !== null && (
        <AnnotationDialog
          editing={draft.kind === "edit"}
          initial={
            draft.kind === "edit"
              ? { color: draft.annotation.color, note: draft.annotation.note }
              : { color: lastColor, note: "" }
          }
          onClose={() => setDraft(null)}
          onSave={({ color, note }) => {
            setLastColor(color);
            annotations.save(
              draft.kind === "edit"
                ? { ...draft.annotation, color, note }
                : newAnnotation({ bookId, page, color, note, rect: draft.rect }),
            );
            setDraft(null);
          }}
          onDelete={
            draft.kind === "edit"
              ? () => {
                  annotations.remove(draft.annotation.id);
                  setDraft(null);
                }
              : undefined
          }
        />
      )}
      {listOpen && (
        <AnnotationsListDialog
          items={annotations.items}
          onClose={() => setListOpen(false)}
          onPick={(annotation) => {
            setListOpen(false);
            goTo(annotation.page);
          }}
        />
      )}
      {findOpen && document.doc && (
        <PdfFindDialog
          doc={document.doc}
          initialTerm={findTerm}
          onOpenChange={setFindOpen}
          onPick={(pickedPage, term) => {
            setFindOpen(false);
            replaceQuery({ page: pickedPage, find: term });
          }}
        />
      )}
      {shortcutsOpen && <ReaderShortcutsDialog open onOpenChange={setShortcutsOpen} />}

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
