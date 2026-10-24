"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, PanelLeft, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Dialog } from "@/components/ui/Dialog";
import { useMediaQuery } from "@/hooks/useMediaQuery";
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
import { currentTocItem, flattenToc } from "@/lib/pdf/toc";
import { swipeDirection } from "@/lib/pdf/swipe";
import { pdfQueries } from "@/lib/pdf-books/queries";
import { cn } from "@/lib/utils/cn";
import { pdfBookPath, ROUTES } from "@/lib/utils/routes";
import { useReaderPrefsStore } from "@/stores/reader-prefs.store";
import { ReportErrorLink } from "@/components/support/ReportErrorLink";
import { BookCover } from "./BookCover";
import { OfflineButton } from "./OfflineButton";
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
import { ReaderBottomBar } from "./reader/ReaderBottomBar";
import { ReaderPanel } from "./reader/ReaderPanel";
import { resolveFileUrl } from "@/lib/pdf/file-url";
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

/** Xato holatidagi zaxira: PDF'ni brauzerning o'z ko'rgichida yangi oynada ochadi. */
function OpenInNewWindowButton({ bookId, label }: { bookId: string; label: string }) {
  const queryClient = useQueryClient();
  const open = async () => {
    // Oyna bosish onida (bloklanmasligi uchun) ochiladi, URL keyin qo'yiladi.
    const popup = window.open("", "_blank");
    try {
      const { url } = await queryClient.fetchQuery(pdfQueries.fileUrl(bookId));
      const target = resolveFileUrl(url, window.location.origin);
      if (popup) popup.location.href = target;
      else window.location.assign(target);
    } catch (error) {
      console.error("[pdf] yangi oynada ochib bo'lmadi", error);
      popup?.close();
    }
  };
  return (
    <Button variant="ghost" onClick={() => void open()}>
      {label}
    </Button>
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
  const tcontrols = useTranslations("pdfBooks.controls");
  const desktop = useMediaQuery("(min-width: 1024px)");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [tocOpen, setTocOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [offlineOpen, setOfflineOpen] = useState(false);
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
  const subjectTitle = book.data ? getLocalized(book.data.subject_title, locale) : "";
  const chapters = book.data?.chapters ?? [];
  const currentChapter =
    page !== null ? currentTocItem(flattenToc(chapters), page)?.title : undefined;
  const subtitle = book.data
    ? [tc("meta", { grade: book.data.grade, subject: subjectTitle }), currentChapter]
        .filter(Boolean)
        .join(" · ")
    : "";
  const percent = page !== null && total > 0 ? Math.max(1, Math.round((page / total) * 100)) : 0;
  const backLink = backHref ?? (book.data ? pdfBookPath(book.data) : ROUTES.textbooks);
  const toolbar =
    page !== null && total > 0 ? (
      <PdfToolbar page={page} total={total} onGo={goTo} />
    ) : (
      <Skeleton className="h-11 w-56" />
    );
  const controlProps = {
    tone,
    fit,
    zoom,
    fullscreen: fullscreen.active,
    fullscreenSupported: fullscreen.supported,
    onTone: cycleTone,
    onFit: toggleFit,
    onZoom: () => setZoom(nextZoom),
    onFullscreen: toggleFullscreen,
    onShortcuts: () => setShortcutsOpen(true),
    onSearch: document.doc ? () => setFindOpen(true) : undefined,
    drawing,
    onDrawing: document.doc ? () => setDrawing((value) => !value) : undefined,
    annotationCount: annotations.items.length,
    onAnnotations: () => setListOpen(true),
  };
  const share = () => {
    const url = window.location.href;
    if (typeof navigator.share === "function") {
      void navigator.share({ title, url }).catch(() => undefined);
    } else {
      void navigator.clipboard?.writeText(url).catch(() => undefined);
    }
  };
  const panel = (onPick?: () => void, scrollOnMount?: boolean) =>
    page !== null && (
      <ReaderPanel
        chapters={chapters}
        page={page}
        description={book.data?.description ?? ""}
        annotations={annotations.items}
        onGo={goTo}
        onOpenSlides={openSlides}
        onPickAnnotation={(annotation) => goTo(annotation.page)}
        onPick={onPick}
        scrollOnMount={scrollOnMount}
      />
    );
  const offlineBook =
    book.data && !backHref
      ? {
          id: bookId,
          slug: book.data.slug,
          grade: book.data.grade,
          title: book.data.title,
          sizeBytes: book.data.size_bytes,
        }
      : null;

  return (
    <div
      ref={stageRef}
      data-tone={tone}
      data-testid="pdf-reader"
      className={cn(
        "pdf-stage bg-reader-bg flex min-h-dvh flex-col",
        fullscreen.active && "overflow-auto",
      )}
    >
      <RecordRecentBook book={counted ? book.data : undefined} />

      <header className="border-border bg-surface sticky top-0 z-20 border-b">
        <div className="flex h-[3.75rem] items-center gap-1 px-2 lg:h-auto lg:flex-wrap lg:gap-4 lg:px-5 lg:py-2.5">
          <div className="flex min-w-0 flex-1 items-center gap-1 lg:gap-3">
            <Link
              href={backLink}
              aria-label={t("back")}
              className="text-foreground lg:border-border inline-flex size-11 shrink-0 items-center justify-center rounded-xl lg:border"
            >
              <ArrowLeft className="size-5" aria-hidden />
            </Link>
            {desktop && (
              <button
                type="button"
                aria-label={t("panelToggle")}
                aria-pressed={sidebarOpen}
                data-testid="pdf-sidebar-toggle"
                onClick={() => setSidebarOpen((value) => !value)}
                className={cn(
                  "inline-flex size-11 shrink-0 items-center justify-center rounded-xl border",
                  sidebarOpen
                    ? "border-brand-soft bg-brand-soft text-brand-text"
                    : "border-border text-foreground",
                )}
              >
                <PanelLeft className="size-5" aria-hidden />
              </button>
            )}
            {book.data && (
              <BookCover
                grade={book.data.grade}
                subject={book.data.subject}
                subjectTitle={subjectTitle}
                src={book.data.cover}
                className="hidden w-8 shrink-0 lg:block"
              />
            )}
            <div className="min-w-0">
              <h1 className="truncate text-base leading-tight font-bold">{title}</h1>
              <p className="text-muted truncate text-xs lg:text-[0.8125rem]">{subtitle}</p>
            </div>
          </div>

          {desktop && toolbar}

          <div className="flex shrink-0 items-center justify-end gap-0.5 lg:flex-1">
            {controlProps.onSearch && !desktop && (
              <button
                type="button"
                data-testid="pdf-find-open"
                aria-label={tcontrols("find")}
                onClick={controlProps.onSearch}
                className="text-foreground inline-flex size-11 items-center justify-center"
              >
                <Search className="size-5" aria-hidden />
              </button>
            )}
            {desktop && <PdfReaderControls {...controlProps} />}
            {book.data && <PdfBookmarkButton bookId={bookId} compact />}
          </div>
        </div>
        <div aria-hidden className="bg-brand-soft h-[3px]">
          <div className="bg-brand h-[3px]" style={{ width: `${percent}%` }} />
        </div>
      </header>

      <div className="flex flex-1 items-stretch">
        {desktop && sidebarOpen && page !== null && (
          <aside
            aria-label={tt("title")}
            className="border-border bg-surface sticky top-[calc(3.75rem+3px)] h-[calc(100dvh-4rem)] w-80 shrink-0 overflow-y-auto border-r p-4"
          >
            {panel()}
            {offlineBook && (
              <div className="border-border mt-4 border-t pt-4">
                <OfflineButton book={offlineBook} />
              </div>
            )}
          </aside>
        )}

        <div className="min-w-0 flex-1 px-2.5 pt-4 pb-40 lg:px-6 lg:pt-8 lg:pb-12">
          {findTerm && (
            <div
              className="mb-3 flex items-center justify-center gap-2 text-sm"
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
              "pdf-page-area mx-auto max-w-[53.75rem] select-none",
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
                  <>
                    <Button variant="secondary" onClick={retry}>
                      {t("retry")}
                    </Button>
                    <OpenInNewWindowButton bookId={bookId} label={t("openInNewWindow")} />
                  </>
                }
              />
            ) : renderFailed ? (
              <ReaderMessage
                message={t("pageError")}
                action={
                  <>
                    <Button variant="secondary" onClick={retry}>
                      {t("retry")}
                    </Button>
                    <OpenInNewWindowButton bookId={bookId} label={t("openInNewWindow")} />
                  </>
                }
              />
            ) : document.doc && page !== null ? (
              <div className={cn("bg-surface rounded-md shadow-lg", zoom > 1 && "overflow-x-auto")}>
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

          {book.data && (
            <div className="mx-auto mt-6 max-w-[53.75rem]">
              <ReportErrorLink topicId={bookId} />
            </div>
          )}
        </div>
      </div>

      {!desktop && page !== null && total > 0 && (
        <ReaderBottomBar
          page={page}
          total={total}
          onGo={goTo}
          onPanel={() => setTocOpen(true)}
          onView={() => setViewOpen(true)}
          onOffline={offlineBook ? () => setOfflineOpen(true) : undefined}
          onShare={share}
        />
      )}

      {!desktop && (
        <>
          <Dialog open={tocOpen} onOpenChange={setTocOpen} title={tt("title")} placement="bottom">
            {panel(() => setTocOpen(false), tocOpen)}
          </Dialog>
          <Dialog open={viewOpen} onOpenChange={setViewOpen} title={t("view")} placement="bottom">
            <PdfReaderControls
              {...controlProps}
              labels
              only="view"
              onAfter={() => setViewOpen(false)}
            />
          </Dialog>
          {offlineBook && (
            <Dialog
              open={offlineOpen}
              onOpenChange={setOfflineOpen}
              title={t("offline")}
              placement="bottom"
            >
              <OfflineButton book={offlineBook} />
            </Dialog>
          )}
        </>
      )}

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
    </div>
  );
}
