"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { useBookBookmarks } from "@/hooks/useBookBookmarks";
import { useBookProgress } from "@/hooks/useBookProgress";
import { useFullscreen } from "@/hooks/useFullscreen";
import type { BookDetail, BookPage } from "@/lib/books/api";
import { currentChapter, effectiveView, stepPage } from "@/lib/books/reader";
import { clampPage, parsePageParam } from "@/lib/pdf/page-nav";
import { clampZoom, DEFAULT_ZOOM, MAX_ZOOM } from "@/lib/pdf/zoom";
import { useBookReaderStore } from "@/stores/book-reader.store";
import { BookReaderSkeleton } from "./BookReaderSkeleton";
import { FindDialog } from "./FindDialog";
import { PageView } from "./PageView";
import { ReaderBottomBar, ReaderTopBar } from "./ReaderBars";
import { TextView } from "./TextView";
import { TocDialog } from "./TocDialog";
import { useIdleChrome } from "./useIdleChrome";

const ZOOM_STEP = 0.5;

const subscribeHydration = (callback: () => void) =>
  useBookReaderStore.persist.onFinishHydration(callback);
const isHydrated = () => useBookReaderStore.persist.hasHydrated();

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
}

export interface BookReaderProps {
  book: BookDetail;
  pages: readonly BookPage[];
}

/**
 * Kitob o'qish oynasi: bet rasmi (yoki matnli rejim), tepa/pastki panel (o'zi yashiriladi),
 * mundarija + xatcho'plar, kitob ichida qidirish, zoom, to'liq ekran, klaviatura va swipe.
 * Oxirgi bet avtomatik saqlanadi (kirgan — server, mehmon — brauzer); URL'da `?bet=N`.
 */
export function BookReader({ book, pages }: BookReaderProps) {
  const total = pages.length;
  const searchParams = useSearchParams();
  const root = useRef<HTMLDivElement>(null);
  const fullscreen = useFullscreen(root);
  const hydrated = useSyncExternalStore(subscribeHydration, isHydrated, () => false);
  const progress = useBookProgress(book.id);
  const bookmarks = useBookBookmarks(book.id);
  const view = useBookReaderStore((state) => state.view);
  const theme = useBookReaderStore((state) => state.theme);
  const font = useBookReaderStore((state) => state.font);
  const fontSize = useBookReaderStore((state) => state.fontSize);
  const lineHeight = useBookReaderStore((state) => state.lineHeight);
  const setView = useBookReaderStore((state) => state.setView);

  const [tocOpen, setTocOpen] = useState(false);
  const [tocTab, setTocTab] = useState<"contents" | "bookmarks">("contents");
  const [findOpen, setFindOpen] = useState(false);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [lookOpen, setLookOpen] = useState(false);
  const chrome = useIdleChrome(tocOpen || findOpen || lookOpen);

  // Boshlang'ich bet: URL (`?bet=`) > saqlangan oxirgi bet > 1. Saqlangan bet aniqlangach bir marta.
  const [start, setStart] = useState<number | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  if (start === null && hydrated && progress.ready) {
    const fromUrl = parsePageParam(searchParams.get("bet"), total);
    setStart(fromUrl ?? clampPage(progress.lastPage ?? 1, total));
  }
  const page = chosen ?? start;

  const hasText = pages.some((item) => item.has_text);
  const activeView = effectiveView(view, hasText);
  const { save } = progress;

  const go = useCallback(
    (target: number) => {
      setChosen(clampPage(target, total));
      setZoom(DEFAULT_ZOOM);
    },
    [total],
  );
  const step = useCallback(
    (direction: 1 | -1) => setChosen((current) => stepPage(current ?? 1, total, direction)),
    [total],
  );
  const changeZoom = useCallback((value: number) => {
    setZoom(Math.min(MAX_ZOOM, Math.max(DEFAULT_ZOOM, clampZoom(value))));
  }, []);

  // Joriy bet URL'ga va saqlashga yoziladi (sahifa yangilansa / havola ulashilsa shu betdan ochiladi).
  useEffect(() => {
    if (page === null) return;
    const url = new URL(window.location.href);
    url.searchParams.set("bet", String(page));
    window.history.replaceState(window.history.state, "", url);
    save(page);
  }, [page, save]);

  useEffect(() => {
    void useBookReaderStore.persist.rehydrate();
  }, []);

  const { toggle: toggleBookmark } = bookmarks;
  const toggleBookmarkHere = useCallback(() => {
    if (page !== null) toggleBookmark(page);
  }, [page, toggleBookmark]);
  const openToc = useCallback((tab: "contents" | "bookmarks" = "contents") => {
    setTocTab(tab);
    setTocOpen(true);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.altKey || event.metaKey || isTyping(event.target)) return;
      if (event.ctrlKey) {
        if (event.key.toLowerCase() === "f") {
          event.preventDefault();
          setFindOpen(true);
        }
        return;
      }
      if (tocOpen || findOpen) return;
      const key = event.key;
      if (key === "ArrowRight" || key === "PageDown") step(1);
      else if (key === "ArrowLeft" || key === "PageUp") step(-1);
      else if (key === "Home") go(1);
      else if (key === "End") go(total);
      else if (key === "+" || key === "=") changeZoom(zoom + ZOOM_STEP);
      else if (key === "-") changeZoom(zoom - ZOOM_STEP);
      else if (key === "0") changeZoom(DEFAULT_ZOOM);
      else if (key.toLowerCase() === "f") fullscreen.toggle();
      else if (key.toLowerCase() === "t") openToc();
      else if (key.toLowerCase() === "b") toggleBookmarkHere();
      else if (key === "/") setFindOpen(true);
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    step,
    go,
    total,
    changeZoom,
    zoom,
    fullscreen,
    openToc,
    toggleBookmarkHere,
    tocOpen,
    findOpen,
  ]);

  if (page === null) return <BookReaderSkeleton />;

  const chapter = currentChapter(book.chapters, page);

  return (
    <div
      ref={root}
      data-book-reader
      data-book-theme={theme}
      className="bg-bk-stage text-bk-ink relative flex h-dvh flex-col overflow-hidden"
    >
      {activeView === "text" ? (
        <TextView
          bookId={book.id}
          page={page}
          total={total}
          prefs={{ font, fontSize, lineHeight }}
          onStep={step}
          onTap={chrome.toggle}
          onShowPage={() => setView("page")}
        />
      ) : (
        <PageView
          title={book.title}
          pages={pages}
          page={page}
          zoom={zoom}
          onZoomChange={changeZoom}
          onStep={step}
          onTap={chrome.toggle}
        />
      )}

      <ReaderTopBar
        visible={chrome.visible}
        bookId={book.id}
        title={book.title}
        chapterTitle={chapter?.title ?? null}
        bookmarked={bookmarks.isBookmarked(page)}
        fullscreen={fullscreen}
        prefs={{ view: activeView, theme, font, fontSize, lineHeight }}
        hasText={hasText}
        onLookOpenChange={setLookOpen}
        onOpenToc={() => openToc()}
        onOpenFind={() => setFindOpen(true)}
        onToggleBookmark={toggleBookmarkHere}
      />
      <ReaderBottomBar
        visible={chrome.visible}
        page={page}
        total={total}
        chapterTitle={(target) => currentChapter(book.chapters, target)?.title ?? null}
        zoom={activeView === "page" ? zoom : null}
        onZoom={(direction) => changeZoom(zoom + direction * ZOOM_STEP)}
        onZoomReset={() => changeZoom(DEFAULT_ZOOM)}
        onGo={go}
      />

      <TocDialog
        open={tocOpen}
        onOpenChange={setTocOpen}
        chapters={book.chapters}
        bookmarks={bookmarks.pages}
        page={page}
        onGo={go}
        onRemoveBookmark={toggleBookmark}
        tab={tocTab}
        onTabChange={setTocTab}
      />
      <FindDialog
        open={findOpen}
        onOpenChange={setFindOpen}
        bookId={book.id}
        searchable={hasText}
        onGo={go}
      />
    </div>
  );
}
