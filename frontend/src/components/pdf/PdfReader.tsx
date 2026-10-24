"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronDown, ChevronUp, PanelLeft, Search } from "lucide-react";
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
import { useReaderZoom } from "@/hooks/useReaderZoom";
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
import { isDoubleTap, type TapPoint } from "@/lib/pdf/reader-prefs";
import {
  nextSpread,
  parseModeParam,
  prevSpread,
  resolveMode,
  type ReadingMode,
} from "@/lib/pdf/reading-mode";
import { parseSlidesParams, readSlidesProgress, withSlidesParams } from "@/lib/pdf/slides";
import { currentTocItem, flattenToc } from "@/lib/pdf/toc";
import { swipeDirection } from "@/lib/pdf/swipe";
import { DEFAULT_ZOOM } from "@/lib/pdf/zoom";
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
import { HorizontalView, type RenderPageOptions } from "./reader/HorizontalView";
import { ReaderBottomBar } from "./reader/ReaderBottomBar";
import { ReaderPanel } from "./reader/ReaderPanel";
import { ReadingModeToggle } from "./reader/ReadingModeToggle";
import { ThumbnailStrip } from "./reader/ThumbnailStrip";
import { VerticalView } from "./reader/VerticalView";
import { resolveFileUrl } from "@/lib/pdf/file-url";
import { usePdfDocument } from "./usePdfDocument";

const isTypingTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
/** Space fokusdagi tugma/havolani bosadi — varaqlash emas. */
const isPressable = (target: EventTarget | null) =>
  target instanceof HTMLElement && ["BUTTON", "A", "SUMMARY"].includes(target.tagName);

/**
 * Gorizontal ko'rinish balandligi (bet ekranga to'liq sig'adi): ekrandan sarlavha, chekinishlar,
 * mobil pastki panel yoki desktop "Sahifalar" paneli (ochiq bo'lsa lenta ham) va qidiruv chipi
 * egallagan joy (rem) ayriladi.
 */
function horizontalHeight({
  desktop,
  thumbs,
  findChip,
}: {
  desktop: boolean;
  thumbs: boolean;
  findChip: boolean;
}) {
  const reserved = (desktop ? (thumbs ? 15.75 : 9.25) : 14.5) + (findChip ? 3.5 : 0);
  return `calc(100dvh - ${reserved}rem)`;
}

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
 * PDF darslik o'qish oynasi, ikki rejim (`?mode=h|v`, tanlov `localStorage` da ham):
 * gorizontal — bet yoki 2 betlik yoyma ekranga sig'adi, ←→/PgUp/PgDn/Space/swipe bilan
 * varaqlanadi, qo'shni yoymalar oldindan chiziladi; vertikal — uzluksiz scroll, virtualizatsiya
 * (canvas faqat ko'rinayotgan bet ±2 da). Sahifa URL'da (`?page=12`), oxirgi sahifa eslab qolinadi.
 */
export function PdfReader({
  bookId,
  backHref,
  preview = false,
  cover,
}: {
  bookId: string;
  backHref?: string;
  /** Admin oldindan ko'rishi: progress, statistika va "oxirgi ko'rilganlar" yuborilmaydi. */
  preview?: boolean;
  /** Muqova rasmi ochiq API o'rniga (admin preview: admin tanlagan rasm; `null` — generativ). */
  cover?: string | null;
}) {
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
  const progress = usePdfProgress(bookId, total, { track: !preview });
  const document = usePdfDocument(bookId);
  const [renderFailed, setRenderFailed] = useState(false);
  const tcontrols = useTranslations("pdfBooks.controls");
  const desktop = useMediaQuery("(min-width: 1024px)");
  // Yoyma faqat keng landshaft ekranda; planshet/mobil va portretda — bitta bet.
  const wide = useMediaQuery("(min-width: 1024px) and (orientation: landscape)");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [thumbsOpen, setThumbsOpen] = useState(false);
  const [pagesSheetOpen, setPagesSheetOpen] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [offlineOpen, setOfflineOpen] = useState(false);
  const reloads = useRef(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const tone = useReaderPrefsStore((state) => state.tone);
  const storedMode = useReaderPrefsStore((state) => state.mode);
  const cycleTone = useReaderPrefsStore((state) => state.cycleTone);
  const setStoredMode = useReaderPrefsStore((state) => state.setMode);
  // Saqlangan rejim o'qilguncha ko'rinish chizilmaydi (desktopda vertikal "miltillamasin").
  const [prefsReady, setPrefsReady] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const annotations = usePdfAnnotations(bookId);
  const [drawing, setDrawing] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  // Dialog: yangi belgi (chizilgan to'rtburchak va uning beti) yoki mavjudini tahrirlash.
  const [draft, setDraft] = useState<
    | { kind: "new"; rect: AnnotationRect; page: number }
    | { kind: "edit"; annotation: Annotation }
    | null
  >(null);
  const [lastColor, setLastColor] = useState<AnnotationColor>("yellow");
  const findTerm = (searchParams.get("find") ?? "").trim().slice(0, 80);
  // Skanerlangan kitob (backend `has_text_layer: false`): matn yo'q — qidiruv ko'rsatilmaydi.
  // `null` (hali tekshirilmagan) — qidiruv bor, dialog o'zi "skanerlangan" deb aytadi.
  const searchable = Boolean(document.doc) && book.data?.has_text_layer !== false;
  const fullscreen = useFullscreen(stageRef);
  const toggleFullscreen = fullscreen.toggle;

  useEffect(() => {
    void Promise.resolve(useReaderPrefsStore.persist.rehydrate()).finally(() =>
      setPrefsReady(true),
    );
  }, []);

  const mode: ReadingMode = resolveMode(
    parseModeParam(searchParams.get("mode")),
    storedMode,
    desktop,
  );
  const horizontal = mode === "h";
  const spread = horizontal && wide;

  const rawPage = searchParams.get("page");
  const urlPage = total > 0 ? parsePageParam(rawPage, total) : null;
  // Tez varaqlashda (klaviatura, swipe) URL yangilanishi (`router.replace`) kechikadi: so'ralgan bet
  // URL unga yetguncha darhol ko'rsatiladi, keyingi bosish shu betdan hisoblanadi — bosish yo'qolmaydi.
  const [pendingPage, setPendingPage] = useState<number | null>(null);
  if (pendingPage !== null && urlPage === pendingPage) setPendingPage(null);
  // So'ralgan bet > URL > saqlangan pozitsiya > 1. Pozitsiya aniqlanguncha `null`.
  const page =
    total === 0 ? null : (pendingPage ?? urlPage ?? (progress.ready ? progress.resume : null));

  const {
    zoom,
    live: liveZoom,
    stepZoom,
    zoomAtTap,
    beginTouch,
    wasPinch,
    resetPan,
    areaRef: pageAreaRef,
    scrollerRef: zoomScrollerRef,
    contentRef: zoomContentRef,
  } = useReaderZoom({
    stageRef,
    fullscreen: fullscreen.active,
    panY: horizontal ? "scroller" : "page",
  });

  // Gorizontal: yangi sahifa (mundarija, tugmalar, swipe…) doim boshidan ochiladi — oldingi sahifada
  // pastga surilgan bo'lsa ham sarlavha ekranning yuqorisida. Birinchi ochilishda scroll'ga
  // tegilmaydi. Vertikalda scroll'ni `VerticalView` o'zi boshqaradi.
  const shownPage = useRef<number | null>(null);
  useEffect(() => {
    if (page === null) return;
    const previous = shownPage.current;
    shownPage.current = page;
    if (!horizontal || previous === null || previous === page) return;
    const scroller = fullscreen.active ? stageRef.current : window;
    scroller?.scrollTo?.({ top: 0 });
    resetPan();
  }, [page, horizontal, fullscreen.active, resetPan]);

  // Vertikaldan gorizontalga o'tilganda ro'yxat bo'yicha surilgan scroll boshiga qaytadi.
  const shownMode = useRef(mode);
  useEffect(() => {
    const previous = shownMode.current;
    shownMode.current = mode;
    if (previous === mode || mode !== "h") return;
    (fullscreen.active ? stageRef.current : window)?.scrollTo?.({ top: 0 });
  }, [mode, fullscreen.active]);

  // Admin oldindan ko'rishi statistika va "oxirgi ko'rilganlar"ga yozilmaydi.
  const counted = book.data && !book.data.unverified && !preview;
  useBookStats(counted ? bookId : undefined, page);

  // Boshqa parametrlar (`slides`, `slide`) saqlanadi: sahifa almashganda ko'rgich yopilmaydi.
  const replaceQuery = useCallback(
    (patch: Parameters<typeof withSlidesParams>[1]) =>
      router.replace(`${pathname}?${withSlidesParams(searchParams, patch)}`, { scroll: false }),
    [router, pathname, searchParams],
  );
  const setPageInUrl = useCallback(
    (next: number) => {
      setPendingPage(next);
      replaceQuery({ page: next });
    },
    [replaceQuery],
  );

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
    if (page !== null && pendingPage === null && rawPage !== String(page)) {
      replaceQuery({ page });
    }
  }, [page, pendingPage, rawPage, replaceQuery]);

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
  // Oldingi/keyingi: gorizontal yoymada 2 bet, aks holda 1 bet; chegarada `null`.
  const prevPage = page === null ? null : prevSpread(page, spread);
  const nextPage = page === null ? null : nextSpread(page, total, spread);

  const changeMode = useCallback(
    (next: ReadingMode) => {
      setStoredMode(next);
      replaceQuery({ mode: next });
    },
    [setStoredMode, replaceQuery],
  );

  useEffect(() => {
    if (page === null) return;
    const onKey = (event: KeyboardEvent) => {
      // Ctrl/⌘+F: sahifa canvas bo'lgani uchun brauzer qidiruvi foydasiz — kitob ichida qidirish ochiladi.
      if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "f") {
        if (!searchable || window.document.querySelector("dialog[open]")) return;
        event.preventDefault();
        setFindOpen(true);
        return;
      }
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      if (isTypingTarget(event.target)) return;
      // Gorizontalda varaqlash: ← → PgUp PgDn Space (Shift+Space — orqaga). Vertikalda ←/→ —
      // qo'shni betga scroll; PgUp/PgDn/Space brauzerning odatiy scroll'i.
      const space = event.key === " " && !isPressable(event.target);
      const back =
        event.key === "ArrowLeft" ||
        (horizontal && (event.key === "PageUp" || (space && event.shiftKey)));
      const forward =
        event.key === "ArrowRight" ||
        (horizontal && (event.key === "PageDown" || (space && !event.shiftKey)));
      if (back || forward) {
        // Gorizontalda chegarada ham oyna surilmasin (bet ekranga sig'gan).
        if (horizontal) event.preventDefault();
        const target = back ? prevPage : nextPage;
        if (target !== null) {
          event.preventDefault();
          goTo(target);
        }
        return;
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
        stepZoom();
      } else if (event.key === "?") {
        event.preventDefault();
        setShortcutsOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    page,
    total,
    goTo,
    horizontal,
    prevPage,
    nextPage,
    toggleFullscreen,
    cycleTone,
    searchable,
    stepZoom,
  ]);

  const touch = useRef<{ x: number; y: number; at: number } | null>(null);
  const lastTap = useRef<TapPoint | null>(null);
  const onPointerDown = (event: PointerEvent) => {
    // Ikkinchi barmoqda ham: `pointerdown` `touchstart` dan oldin keladi, pinch belgisi keyin qo'yiladi.
    beginTouch();
    touch.current = { x: event.clientX, y: event.clientY, at: event.timeStamp };
  };
  const onPointerUp = (event: PointerEvent) => {
    const start = touch.current;
    touch.current = null;
    // Pinch bo'lgan teginish tap ham, swipe ham emas.
    if (!start || page === null || wasPinch()) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    // Ikki marta bosish (sichqoncha ham, barmoq ham) — zoom 100% ↔ 200% (bosilgan joy markazda
    // qoladi). Sichqoncha bilan matn belgilangan bo'lsa (so'zni ikki marta bosish) — zoom emas.
    if (Math.hypot(dx, dy) < 10) {
      if (event.pointerType === "mouse" && window.getSelection?.()?.isCollapsed === false) return;
      const tap = { x: event.clientX, y: event.clientY, at: event.timeStamp };
      if (isDoubleTap(lastTap.current, tap)) {
        lastTap.current = null;
        zoomAtTap({ x: event.clientX, y: event.clientY });
      } else {
        lastTap.current = tap;
      }
      return;
    }
    // Swipe faqat gorizontal rejimda, barmoq bilan va kattalashtirilmagan sahifada
    // (kattalashganda surish — pan; vertikalda — oddiy scroll).
    if (!horizontal || event.pointerType === "mouse" || zoom > DEFAULT_ZOOM) return;
    const direction = swipeDirection(dx, dy, event.timeStamp - start.at);
    if (direction === "next" && nextPage !== null) goTo(nextPage);
    if (direction === "prev" && prevPage !== null) goTo(prevPage);
  };

  const retry = () => {
    reloads.current = 0;
    setRenderFailed(false);
    document.reload();
  };
  const ignoreRenderError = () => undefined;
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
      <PdfToolbar page={page} total={total} onGo={goTo} prevPage={prevPage} nextPage={nextPage} />
    ) : (
      <Skeleton className="h-11 w-56" />
    );
  const controlProps = {
    tone,
    zoom,
    fullscreen: fullscreen.active,
    fullscreenSupported: fullscreen.supported,
    onTone: cycleTone,
    onZoom: stepZoom,
    onFullscreen: toggleFullscreen,
    onShortcuts: () => setShortcutsOpen(true),
    onSearch: searchable ? () => setFindOpen(true) : undefined,
    drawing,
    onDrawing: document.doc ? () => setDrawing((value) => !value) : undefined,
    annotationCount: annotations.items.length,
    onAnnotations: () => setListOpen(true),
  };
  // Matnli kitobda (backend `has_text_layer` — `false` emas) betlar ustida tanlanadigan matn qatlami.
  const textLayer = book.data?.has_text_layer !== false;
  const renderPage = (
    pageNumber: number,
    options: { current: boolean } & Partial<Omit<RenderPageOptions, "current">>,
  ) =>
    document.doc && (
      <PdfPageCanvas
        doc={document.doc}
        pageNumber={pageNumber}
        label={t("position", { page: pageNumber, total })}
        fit={horizontal ? "contain" : "width"}
        align={options.align}
        current={options.current}
        textLayer={textLayer}
        highlight={findTerm || undefined}
        overlay={
          <AnnotationLayer
            annotations={annotationsOnPage(annotations.items, pageNumber)}
            drawing={drawing}
            onDraw={(rect) => setDraft({ kind: "new", rect, page: pageNumber })}
            onSelect={(annotation) => setDraft({ kind: "edit", annotation })}
          />
        }
        onRendered={() => (reloads.current = 0)}
        // Ko'rinmas prefetch beti xatosi e'tiborsiz: bet ko'ringanda qayta chiziladi va o'shanda aytiladi.
        onError={options.prefetch ? ignoreRenderError : onRenderError}
      />
    );
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
        <div className="flex h-[3.75rem] items-center gap-1 px-2 lg:h-16 lg:gap-4 lg:px-5">
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
                src={cover !== undefined ? cover : book.data.cover}
                className="hidden w-8 shrink-0 lg:block"
              />
            )}
            <div className="min-w-0">
              <h1 className="truncate text-base leading-tight font-bold">{title}</h1>
              <p className="text-muted truncate text-xs lg:text-[0.8125rem]">{subtitle}</p>
            </div>
          </div>

          {desktop && (
            <div className="flex shrink-0 items-center gap-2">
              {toolbar}
              {prefsReady && <ReadingModeToggle mode={mode} onChange={changeMode} />}
            </div>
          )}

          <div className="flex shrink-0 items-center justify-end gap-0.5 lg:min-w-0 lg:flex-1">
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
            {desktop && <PdfReaderControls {...controlProps} overflow />}
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

        <div className="min-w-0 flex-1 px-2.5 pt-4 pb-40 lg:px-6 lg:pb-0">
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
            ref={pageAreaRef}
            data-testid="pdf-page-area"
            data-mode={prefsReady ? mode : undefined}
            className={cn(
              "pdf-page-area mx-auto w-full select-none",
              zoom > DEFAULT_ZOOM ? "touch-pan-x touch-pan-y" : "touch-pan-y",
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
            ) : document.doc && page !== null && prefsReady ? (
              horizontal ? (
                <HorizontalView
                  page={page}
                  total={total}
                  spread={spread}
                  zoom={zoom}
                  live={liveZoom}
                  height={horizontalHeight({
                    desktop,
                    thumbs: thumbsOpen,
                    findChip: Boolean(findTerm),
                  })}
                  scrollerRef={zoomScrollerRef}
                  contentRef={zoomContentRef}
                  onGo={goTo}
                  renderPage={renderPage}
                />
              ) : (
                <VerticalView
                  doc={document.doc}
                  page={page}
                  total={total}
                  zoom={zoom}
                  live={liveZoom}
                  fullscreen={fullscreen.active}
                  stageRef={stageRef}
                  scrollerRef={zoomScrollerRef}
                  contentRef={zoomContentRef}
                  onPageChange={setPageInUrl}
                  renderPage={renderPage}
                />
              )
            ) : (
              <div role="status" aria-label={t("loading")}>
                <Skeleton className="mx-auto aspect-[1/1.4] w-full max-w-3xl" />
              </div>
            )}
          </div>

          {desktop && document.doc && page !== null && total > 0 && (
            <div className="border-border bg-surface sticky bottom-0 z-10 -mx-6 mt-4 border-t print:hidden">
              <button
                type="button"
                aria-expanded={thumbsOpen}
                aria-label={t("pagesToggle")}
                data-testid="pdf-thumbs-toggle"
                onClick={() => setThumbsOpen((value) => !value)}
                className="text-foreground hover:bg-subtle flex h-10 w-full items-center justify-center gap-1.5 text-sm font-semibold"
              >
                {thumbsOpen ? (
                  <ChevronDown className="size-4" aria-hidden />
                ) : (
                  <ChevronUp className="size-4" aria-hidden />
                )}
                {t("pages")}
              </button>
              {thumbsOpen && (
                <ThumbnailStrip doc={document.doc} page={page} total={total} onGo={goTo} />
              )}
            </div>
          )}

          {book.data && (
            <div className="mx-auto mt-6 max-w-[53.75rem] lg:pb-12">
              <ReportErrorLink topicId={bookId} page={page ?? undefined} />
            </div>
          )}
        </div>
      </div>

      {!desktop && page !== null && total > 0 && (
        <ReaderBottomBar
          page={page}
          total={total}
          onGo={goTo}
          prevPage={prevPage}
          nextPage={nextPage}
          onPanel={() => setTocOpen(true)}
          onView={() => setViewOpen(true)}
          zoom={zoom}
          onZoom={stepZoom}
          onPages={document.doc ? () => setPagesSheetOpen(true) : undefined}
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
            <div className="flex flex-col gap-3">
              <ReadingModeToggle
                mode={mode}
                labels
                onChange={(next) => {
                  changeMode(next);
                  setViewOpen(false);
                }}
              />
              <PdfReaderControls
                {...controlProps}
                labels
                only="view"
                onAfter={() => setViewOpen(false)}
              />
            </div>
          </Dialog>
          {document.doc && page !== null && (
            <Dialog
              open={pagesSheetOpen}
              onOpenChange={setPagesSheetOpen}
              title={t("pages")}
              placement="bottom"
            >
              {pagesSheetOpen && (
                <ThumbnailStrip
                  doc={document.doc}
                  page={page}
                  total={total}
                  className="-mx-3"
                  onGo={(next) => {
                    setPagesSheetOpen(false);
                    goTo(next);
                  }}
                />
              )}
            </Dialog>
          )}
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

      {draft && (
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
                : newAnnotation({ bookId, page: draft.page, color, note, rect: draft.rect }),
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
      {findOpen && searchable && document.doc && (
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
