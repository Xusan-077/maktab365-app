"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BookOpenText,
  ChevronDown,
  Highlighter,
  Images,
  Keyboard,
  Maximize,
  Minimize,
  Search,
  Share2,
  WifiOff,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { Dialog } from "@/components/ui/Dialog";
import { OverflowMenu, type OverflowMenuItem } from "@/components/ui/OverflowMenu";
import { TopicPanel, type TopicTab } from "@/components/topic/TopicPanel";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useBookStats } from "@/hooks/useBookStats";
import { useFullscreen } from "@/hooks/useFullscreen";
import { usePdfAnnotations } from "@/hooks/usePdfAnnotations";
import { usePdfProgress } from "@/hooks/usePdfProgress";
import { useReaderZoom } from "@/hooks/useReaderZoom";
import { useToast } from "@/hooks/useToast";
import { ApiError } from "@/lib/api/types";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { Link } from "@/lib/i18n/navigation";
import {
  annotationsOnPage,
  newAnnotation,
  type Annotation,
  type AnnotationColor,
  type AnnotationRect,
} from "@/lib/pdf/annotations";
import { clampPage, parsePageParam } from "@/lib/pdf/page-nav";
import { isDoubleTap, type TapPoint } from "@/lib/pdf/reader-prefs";
import { BOOK_SPREAD_MIN_WIDTH } from "@/lib/pdf/book";
import {
  nextSpread,
  parseModeParam,
  prevSpread,
  resolveMode,
  spreadStart,
  type ReadingMode,
} from "@/lib/pdf/reading-mode";
import { parseSlidesParams, readSlidesProgress, withSlidesParams } from "@/lib/pdf/slides";
import { currentTocItem, flattenToc } from "@/lib/pdf/toc";
import { DEFAULT_ZOOM } from "@/lib/pdf/zoom";
import { pdfQueries } from "@/lib/pdf-books/queries";
import { cn } from "@/lib/utils/cn";
import { pdfBookPath, ROUTES } from "@/lib/utils/routes";
import { useReaderPrefsStore } from "@/stores/reader-prefs.store";
import { useTopicNotesStore } from "@/stores/topic-notes.store";
import { ReportErrorLink } from "@/components/support/ReportErrorLink";
import { OfflineButton } from "./OfflineButton";
import { RecordRecentBook } from "./RecordRecentBook";
import { PdfBookmarkButton } from "./PdfBookmarkButton";
import { AnnotationDialog } from "./AnnotationDialog";
import { AnnotationLayer } from "./AnnotationLayer";
import { PdfFindDialog } from "./PdfFindDialog";
import { PdfPageCanvas } from "./PdfPageCanvas";
import { PdfTocDrawer } from "./PdfTocDrawer";
import { ReaderShortcutsDialog } from "./ReaderShortcutsDialog";
import { PdfSlidesViewer } from "./PdfSlidesViewer";
import { BookView, type BookRenderOptions } from "./reader/BookView";
import { BookZoomControls } from "./reader/BookZoomControls";
import { PageNumberInput } from "./reader/PageNumberInput";
import { AppearanceMenu } from "./reader/ReaderAppearance";
import { ReaderFloatingNav } from "./reader/ReaderFloatingNav";
import { READER_ICON_BUTTON } from "./reader/reader-styles";
import { SelectionMenu, type TextSelection } from "./reader/SelectionMenu";
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
 * Sarlavha (3.5rem + 3px progress), bet ustidagi chekinish va pastdagi suzuvchi panel egallagan joy:
 * vertikal «butun bet» masshtabi shundan hisoblanadi.
 */
const CHROME_REM = 10;
const REM_PX = 16;
/** Desktopda o'ngdan ochiladigan Mavzu paneli eni (px): kitob qolgan joyga moslanadi. */
const TOPIC_PANEL_PX = 480;

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
 * PDF darslik o'qish oynasi — «fokus rejimi»: yupqa sarlavha (orqaga, kitob nomi + joriy bo'lim →
 * Mundarija, bet raqami, qidiruv, Aa, Mavzu, Saqlash, «⋯») va 3px progress, pastda suzuvchi
 * navigatsiya. Standart — «Kitob» (ochiq kitob, varaq ag'darish; ≥1024px da 2 bet), Aa menyusida
 * «Uzluksiz» (vertikal scroll, virtualizatsiya). Sahifa URL'da (`?page=12`, `history.replaceState`),
 * oxirgi sahifa eslab qolinadi.
 */
export function PdfReader({
  bookId,
  backHref,
  preview = false,
}: {
  bookId: string;
  backHref?: string;
  /** Admin oldindan ko'rishi: progress, statistika va "oxirgi ko'rilganlar" yuborilmaydi. */
  preview?: boolean;
}) {
  const t = useTranslations("pdfBooks.reader");
  const tc = useTranslations("pdfBooks.card");
  const tf = useTranslations("pdfBooks.find");
  const tcontrols = useTranslations("pdfBooks.controls");
  const ts = useTranslations("pdfBooks.selection");
  const tb = useTranslations("brand");
  const locale = useLocale() as Locale;
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const book = useQuery(pdfQueries.book(bookId));
  const total = book.data?.page_count ?? 0;
  const progress = usePdfProgress(bookId, total, { track: !preview });
  const document = usePdfDocument(bookId);
  const [renderFailed, setRenderFailed] = useState(false);
  const desktop = useMediaQuery("(min-width: 1024px)");
  const twoPageWide = useMediaQuery(`(min-width: ${BOOK_SPREAD_MIN_WIDTH}px)`);
  const [tocOpen, setTocOpen] = useState(false);
  const [topicOpen, setTopicOpen] = useState(false);
  const [topicTab, setTopicTab] = useState<TopicTab>("summary");
  const [pagesSheetOpen, setPagesSheetOpen] = useState(false);
  const [offlineOpen, setOfflineOpen] = useState(false);
  const reloads = useRef(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const pageBoxRef = useRef<HTMLDivElement>(null);
  const prefs = useReaderPrefsStore();
  // Saqlangan rejim o'qilguncha ko'rinish chizilmaydi (rejim "miltillamasin").
  const [prefsReady, setPrefsReady] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [findOpen, setFindOpen] = useState(false);
  const annotations = usePdfAnnotations(bookId);
  const addNote = useTopicNotesStore((state) => state.add);
  const [drawing, setDrawing] = useState(false);
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
  const { cycleTone } = prefs;

  useEffect(() => {
    void Promise.resolve(useReaderPrefsStore.persist.rehydrate()).finally(() =>
      setPrefsReady(true),
    );
  }, []);

  const mode: ReadingMode = resolveMode(parseModeParam(searchParams.get("mode")), prefs.mode);
  const bookMode = mode === "b";
  // Ochiq kitob (2 bet) — «Kitob» rejimida ≥1024px; aks holda bitta bet.
  const spread = bookMode && twoPageWide;

  const rawPage = searchParams.get("page");
  const urlPage = total > 0 ? parsePageParam(rawPage, total) : null;
  // Tez varaqlashda (klaviatura, swipe) URL yangilanishi (`useSearchParams`) kechikadi: so'ralgan bet
  // URL unga yetguncha darhol ko'rsatiladi, keyingi bosish shu betdan hisoblanadi — bosish yo'qolmaydi.
  const [pendingPage, setPendingPage] = useState<number | null>(null);
  if (pendingPage !== null && urlPage === pendingPage) setPendingPage(null);
  // So'ralgan bet > URL > saqlangan pozitsiya > 1. Pozitsiya aniqlanguncha `null`.
  const requested =
    total === 0 ? null : (pendingPage ?? urlPage ?? (progress.ready ? progress.resume : null));
  // Ochiq kitobda URL'ga yoymaning chap (yoki yolg'iz) beti yoziladi.
  const page = requested === null ? null : spread ? spreadStart(requested, true) : requested;

  // «Davom ettirish» kartasi: oyna ochilgandagi saqlangan joy (keyingi yozuvlar uni o'zgartirmaydi).
  const [resumeAt, setResumeAt] = useState<number | null | undefined>(undefined);
  if (resumeAt === undefined && progress.ready) setResumeAt(progress.position?.page ?? null);

  const {
    zoom,
    live: liveZoom,
    stepZoom,
    nudge: nudgeZoomLevel,
    setZoomLevel,
    zoomAtTap,
    beginTouch,
    wasPinch,
    areaRef: pageAreaRef,
    scrollerRef: zoomScrollerRef,
    contentRef: zoomContentRef,
  } = useReaderZoom({ stageRef, fullscreen: fullscreen.active });
  const setPageArea = useCallback(
    (element: HTMLDivElement | null) => {
      pageBoxRef.current = element;
      pageAreaRef(element);
    },
    [pageAreaRef],
  );
  // Kitob rejimida zoom/pan/pinch'ni `BookView` o'zi boshqaradi — bu yerda faqat belgilash maydoni.
  const setBookArea = useCallback((element: HTMLDivElement | null) => {
    pageBoxRef.current = element;
  }, []);

  // Admin oldindan ko'rishi statistika va "oxirgi ko'rilganlar"ga yozilmaydi.
  const counted = book.data && !book.data.unverified && !preview;
  useBookStats(counted ? bookId : undefined, page);

  // Boshqa parametrlar (`slides`, `slide`) saqlanadi: sahifa almashganda ko'rgich yopilmaydi.
  // `history.replaceState` — Next router bilan sinxron (`useSearchParams` yangilanadi), lekin RSC
  // so'rovi va navigatsiyasiz: tez varaqlashda ham arzon. Holat `null` bo'lishi shart: Next'ning
  // ichki holati uzatilsa chaqiruv routerniki deb hisoblanadi va `useSearchParams` yangilanmaydi.
  const replaceQuery = useCallback(
    (patch: Parameters<typeof withSlidesParams>[1]) =>
      window.history.replaceState(null, "", `?${withSlidesParams(searchParams, patch)}`),
    [searchParams],
  );
  const setPageInUrl = useCallback(
    (next: number) => {
      setPendingPage(next);
      replaceQuery({ page: next });
    },
    [replaceQuery],
  );

  // Prezentatsiya (PDF slaydlar): `?slides=<bo'lim id>&slide=N`; faqat prezentatsiyasi bor bo'lim.
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
      prefs.setMode(next);
      replaceQuery({ mode: next });
    },
    [prefs, replaceQuery],
  );

  const chapters = useMemo(() => book.data?.chapters ?? [], [book.data]);
  const tocItems = useMemo(() => flattenToc(chapters), [chapters]);
  const currentItem = page !== null ? currentTocItem(tocItems, page) : null;
  const exercisePage =
    currentItem?.anchors?.find((anchor) => anchor.kind === "exercise")?.page ?? null;
  const openTopic = useCallback((tab: TopicTab) => {
    setTopicTab(tab);
    setTopicOpen(true);
  }, []);

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
      // Varaqlash: ← → (ikkala rejimda); kitobda PgUp PgDn Space (Shift+Space — orqaga) ham.
      // Uzluksiz rejimda PgUp/PgDn/Space — brauzerning odatiy scroll'i.
      const space = event.key === " " && !isPressable(event.target);
      const back =
        event.key === "ArrowLeft" ||
        (bookMode && (event.key === "PageUp" || (space && event.shiftKey)));
      const forward =
        event.key === "ArrowRight" ||
        (bookMode && (event.key === "PageDown" || (space && !event.shiftKey)));
      if (back || forward) {
        // Kitobda chegarada ham oyna surilmasin (kitob ekranga sig'gan).
        if (bookMode) event.preventDefault();
        const target = back ? prevPage : nextPage;
        if (target !== null) {
          event.preventDefault();
          goTo(target);
        }
        return;
      }
      // Qolgan yorliqlar ochiq dialog (mundarija, mavzu, prezentatsiya, yordam) ustida ishlamaydi.
      if (window.document.querySelector("dialog[open]")) return;
      const key = event.key.toLowerCase();
      if (event.key === "Home" && page > 1) {
        event.preventDefault();
        goTo(1);
      } else if (event.key === "End" && page < total) {
        event.preventDefault();
        goTo(total);
      } else if (event.key === "/" && searchable) {
        event.preventDefault();
        setFindOpen(true);
      } else if (key === "m") {
        event.preventDefault();
        setTocOpen(true);
      } else if (key === "f") {
        event.preventDefault();
        toggleFullscreen();
      } else if (key === "t") {
        cycleTone();
      } else if (key === "z") {
        stepZoom();
      } else if (event.key === "+" || event.key === "=") {
        event.preventDefault();
        nudgeZoomLevel(1);
      } else if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        nudgeZoomLevel(-1);
      } else if (event.key === "0") {
        event.preventDefault();
        setZoomLevel(DEFAULT_ZOOM);
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
    bookMode,
    prevPage,
    nextPage,
    toggleFullscreen,
    cycleTone,
    searchable,
    stepZoom,
    nudgeZoomLevel,
    setZoomLevel,
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
    // Uzluksiz rejimda barmoq harakati — oddiy scroll (swipe yo'q); kitobda — `BookView`.
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
  const subtitle =
    currentItem?.title ??
    (book.data ? tc("meta", { grade: book.data.grade, subject: subjectTitle }) : "");
  const percent = page !== null && total > 0 ? Math.max(1, Math.round((page / total) * 100)) : 0;
  const backLink = backHref ?? (book.data ? pdfBookPath(book.data) : ROUTES.textbooks);
  // Matnli kitobda (backend `has_text_layer` — `false` emas) betlar ustida tanlanadigan matn qatlami.
  const textLayer = book.data?.has_text_layer !== false;
  const renderPage = (
    pageNumber: number,
    options: { current: boolean } & Partial<Omit<BookRenderOptions, "current">>,
  ) =>
    document.doc && (
      <PdfPageCanvas
        doc={document.doc}
        pageNumber={pageNumber}
        label={t("position", { page: pageNumber, total })}
        fit={bookMode ? "contain" : "width"}
        align={options.align}
        current={options.current}
        variant={bookMode ? "book" : "sheet"}
        renderScale={options.renderScale}
        pool={options.pool}
        priority={options.priority}
        textLayer={textLayer}
        highlight={findTerm || undefined}
        overlay={
          <>
            <AnnotationLayer
              annotations={annotationsOnPage(annotations.items, pageNumber)}
              drawing={drawing}
              onDraw={(rect) => setDraft({ kind: "new", rect, page: pageNumber })}
              onSelect={(annotation) => setDraft({ kind: "edit", annotation })}
            />
            {/* Suv belgisi: bet burchagida kichik (rasmning o'ziga tegilmaydi). */}
            <span aria-hidden className="pdf-page-mark">
              {tb("name")}
            </span>
          </>
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

  const topicOf = (pageNumber: number) => currentTocItem(tocItems, pageNumber);
  const onSelectionNote = (selection: TextSelection) => {
    const topic = topicOf(selection.page);
    if (!topic) return;
    addNote({ bookId, topicId: topic.id, page: selection.page, text: selection.text });
    toast({ variant: "success", title: ts("noted") });
  };
  const onSelectionHighlight = (selection: TextSelection) => {
    const [first] = selection.rects;
    if (!first) return;
    annotations.save({
      ...newAnnotation({ bookId, page: selection.page, color: lastColor, rect: first }),
      rects: selection.rects,
    });
    toast({ variant: "success", title: ts("highlighted") });
  };

  const moreItems: OverflowMenuItem[] = [
    ...(searchable && !desktop
      ? [
          {
            id: "find",
            label: tcontrols("find"),
            icon: <Search className="size-4" />,
            onSelect: () => setFindOpen(true),
            testId: "pdf-find-open",
          },
        ]
      : []),
    ...(document.doc
      ? [
          {
            id: "highlight",
            label: tcontrols("highlight"),
            icon: <Highlighter className="size-4" />,
            pressed: drawing,
            onSelect: () => setDrawing((value) => !value),
            testId: "pdf-highlight",
          },
          {
            id: "pages",
            label: t("pages"),
            icon: <Images className="size-4" />,
            onSelect: () => setPagesSheetOpen(true),
            testId: "pdf-pages",
          },
        ]
      : []),
    ...(fullscreen.supported
      ? [
          {
            id: "fullscreen",
            label: tcontrols(fullscreen.active ? "exitFullscreen" : "fullscreen"),
            icon: fullscreen.active ? (
              <Minimize className="size-4" />
            ) : (
              <Maximize className="size-4" />
            ),
            onSelect: toggleFullscreen,
            testId: "pdf-fullscreen",
          },
        ]
      : []),
    ...(offlineBook
      ? [
          {
            id: "offline",
            label: t("offline"),
            icon: <WifiOff className="size-4" />,
            onSelect: () => setOfflineOpen(true),
            testId: "pdf-offline",
          },
        ]
      : []),
    {
      id: "share",
      label: t("share"),
      icon: <Share2 className="size-4" />,
      onSelect: share,
      testId: "pdf-share",
    },
    ...(desktop
      ? [
          {
            id: "shortcuts",
            label: tcontrols("shortcuts"),
            icon: <Keyboard className="size-4" />,
            onSelect: () => setShortcutsOpen(true),
            testId: "pdf-shortcuts",
          },
        ]
      : []),
  ];

  return (
    <div
      ref={stageRef}
      data-tone={prefs.tone}
      data-warm={prefs.warm || undefined}
      data-testid="pdf-reader"
      data-book={bookMode || undefined}
      className={cn(
        "pdf-stage bg-ds-canvas text-ds-ink font-ui flex flex-col",
        // Kitob: sahifa scroll'i yo'q, kitob stage markazida qotib turadi.
        bookMode ? "h-dvh overflow-hidden overscroll-none" : "min-h-dvh",
        fullscreen.active && !bookMode && "overflow-auto",
      )}
    >
      <RecordRecentBook book={counted ? book.data : undefined} />

      <header
        className={cn(
          "border-ds-line bg-ds-surface z-20 border-b print:hidden",
          bookMode ? "relative shrink-0" : "sticky top-0",
        )}
      >
        <div className="flex h-14 items-center gap-1 px-2 lg:gap-2 lg:px-4">
          <Link href={backLink} aria-label={t("back")} className={READER_ICON_BUTTON}>
            <ArrowLeft className="size-5" aria-hidden />
          </Link>

          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={tocOpen}
            aria-label={t("tocOpen", { title, section: subtitle })}
            data-testid="pdf-toc-open"
            disabled={page === null}
            onClick={() => setTocOpen(true)}
            className="hover:bg-ds-canvas rounded-ds-sm flex min-h-11 min-w-0 flex-1 items-center gap-2 px-2 text-left transition-colors lg:max-w-[min(32rem,40vw)] lg:flex-none"
          >
            <span className="min-w-0">
              <span className="font-book block truncate text-[0.9375rem] leading-tight font-semibold">
                {title}
              </span>
              <span
                className="text-ds-muted block truncate text-xs"
                data-testid="pdf-current-section"
              >
                {subtitle}
              </span>
            </span>
            <ChevronDown className="text-ds-muted size-4 shrink-0" aria-hidden />
          </button>

          <div className="hidden flex-1 lg:block" />

          {page !== null && total > 0 ? (
            <PageNumberInput page={page} total={total} onGo={goTo} className="max-sm:hidden" />
          ) : (
            <Skeleton className="h-11 w-28 max-sm:hidden" />
          )}

          {bookMode && prefsReady && desktop && (
            <BookZoomControls zoom={zoom} onZoom={setZoomLevel} className="mx-1" />
          )}

          <div className="flex shrink-0 items-center gap-0.5">
            {searchable && desktop && (
              <button
                type="button"
                data-testid="pdf-find-open"
                aria-label={tcontrols("find")}
                aria-keyshortcuts="/ Control+F"
                onClick={() => setFindOpen(true)}
                className={READER_ICON_BUTTON}
              >
                <Search className="size-5" aria-hidden />
              </button>
            )}
            {prefsReady && (
              <AppearanceMenu
                desktop={desktop}
                tone={prefs.tone}
                mode={mode}
                fit={prefs.fit}
                zoom={zoom}
                warm={prefs.warm}
                onTone={prefs.setTone}
                onMode={changeMode}
                onFit={prefs.setFit}
                onZoom={setZoomLevel}
                onWarm={prefs.setWarm}
              />
            )}
            {currentItem && (
              <button
                type="button"
                aria-haspopup="dialog"
                aria-expanded={topicOpen}
                data-testid="pdf-topic-open"
                onClick={() => openTopic("summary")}
                className={cn(
                  READER_ICON_BUTTON,
                  "lg:w-auto lg:gap-1.5 lg:px-3 lg:text-sm lg:font-semibold",
                )}
              >
                <BookOpenText className="size-5" aria-hidden />
                <span className="max-lg:sr-only">{t("topic")}</span>
              </button>
            )}
            {book.data && <PdfBookmarkButton bookId={bookId} compact />}
            <OverflowMenu items={moreItems} label={t("more")} testId="pdf-more" />
          </div>
        </div>
        <div aria-hidden className="bg-ds-accent-tint h-[3px]">
          <div
            className="bg-ds-accent h-[3px] transition-[width]"
            style={{ width: `${percent}%` }}
          />
        </div>
      </header>

      {bookMode ? (
        <div className="relative min-h-0 min-w-0 flex-1">
          {findTerm && (
            <div
              className="bg-ds-surface/90 absolute inset-x-0 top-0 z-10 flex items-center justify-center gap-2 text-sm backdrop-blur"
              data-testid="pdf-find-chip"
            >
              <span className="text-ds-muted">{tf("highlighted", { term: findTerm })}</span>
              <button
                type="button"
                onClick={() => replaceQuery({ find: null })}
                className="text-ds-accent-ink min-h-11 font-semibold underline underline-offset-4"
              >
                {tf("clear")}
              </button>
            </div>
          )}
          {document.error && !document.doc ? (
            <div className="px-4">
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
            </div>
          ) : renderFailed ? (
            <div className="px-4">
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
            </div>
          ) : document.doc && page !== null && prefsReady ? (
            <BookView
              doc={document.doc}
              page={page}
              total={total}
              twoPage={spread}
              reserveRight={topicOpen && desktop ? TOPIC_PANEL_PX : 0}
              onGo={goTo}
              renderPage={renderPage}
              areaRef={setBookArea}
            />
          ) : (
            <div role="status" aria-label={t("loading")} className="flex h-full justify-center p-7">
              <Skeleton className="aspect-[1/1.4] h-full max-h-[calc(100%-4.5rem)]" />
            </div>
          )}
          {book.data && (
            <div className="absolute bottom-[4.75rem] left-3 z-10 max-sm:hidden">
              <ReportErrorLink topicId={bookId} page={page ?? undefined} />
            </div>
          )}
        </div>
      ) : (
        <div className="min-w-0 flex-1 px-2.5 pt-4 pb-28 lg:px-6">
          {findTerm && (
            <div
              className="mb-3 flex items-center justify-center gap-2 text-sm"
              data-testid="pdf-find-chip"
            >
              <span className="text-ds-muted">{tf("highlighted", { term: findTerm })}</span>
              <button
                type="button"
                onClick={() => replaceQuery({ find: null })}
                className="text-ds-accent-ink min-h-11 font-semibold underline underline-offset-4"
              >
                {tf("clear")}
              </button>
            </div>
          )}

          <div
            ref={setPageArea}
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
                fit={prefs.fit}
                pageReserve={CHROME_REM * REM_PX}
              />
            ) : (
              <div role="status" aria-label={t("loading")}>
                <Skeleton className="mx-auto aspect-[1/1.4] w-full max-w-3xl" />
              </div>
            )}
          </div>

          {book.data && (
            <div className="mx-auto mt-6 max-w-[53.75rem]">
              <ReportErrorLink topicId={bookId} page={page ?? undefined} />
            </div>
          )}
        </div>
      )}

      {page !== null && total > 0 && (
        <ReaderFloatingNav
          page={page}
          total={total}
          items={tocItems}
          prevPage={prevPage}
          nextPage={nextPage}
          onGo={goTo}
          exercisePage={exercisePage}
          onTest={currentItem ? () => openTopic("test") : undefined}
        />
      )}

      {textLayer && document.doc && (
        <SelectionMenu
          areaRef={pageBoxRef}
          onSolution={() => openTopic("summary")}
          onNote={onSelectionNote}
          onHighlight={onSelectionHighlight}
        />
      )}

      {page !== null && (
        <PdfTocDrawer
          open={tocOpen}
          onOpenChange={setTocOpen}
          chapters={chapters}
          page={page}
          total={total}
          resume={resumeAt ?? null}
          onGo={goTo}
          onOpenSlides={openSlides}
          annotations={annotations.items}
          onPickAnnotation={(annotation) => goTo(annotation.page)}
        />
      )}

      {currentItem && book.data && (
        <TopicPanel
          open={topicOpen}
          onOpenChange={setTopicOpen}
          tab={topicTab}
          onTabChange={setTopicTab}
          topic={{ id: currentItem.id, title: currentItem.title }}
          bookId={bookId}
          slides={currentItem.slides ?? null}
          onOpenSlides={() => {
            setTopicOpen(false);
            openSlides(currentItem.id, readSlidesProgress(currentItem.id) ?? 1);
          }}
          desktop={desktop}
        />
      )}

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
          placement={desktop ? "center" : "bottom"}
        >
          <OfflineButton book={offlineBook} />
        </Dialog>
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
