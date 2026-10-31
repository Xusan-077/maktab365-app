"use client";

import { useState } from "react";
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  List,
  Maximize,
  Minimize,
  Minus,
  NotebookPen,
  Plus,
  Search,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { PageNumberInput } from "@/components/pdf/reader/PageNumberInput";
import { formatZoom } from "@/lib/pdf/zoom";
import { progressPercent } from "@/lib/books/reader";
import { bookPath } from "@/lib/utils/routes";
import { cn } from "@/lib/utils/cn";
import { AppearanceMenu } from "./AppearanceMenu";
import { BK_ICON_BUTTON, withKey } from "./reader-styles";
import type { BookReaderPrefs } from "@/lib/books/reader";

const BAR =
  "bg-bk-bar/95 border-bk-line text-bk-ink absolute inset-x-0 z-20 flex h-16 items-center gap-1 border-b px-2 backdrop-blur transition-transform duration-250 ease-out sm:px-4";

export interface TopBarProps {
  visible: boolean;
  bookId: string;
  title: string;
  chapterTitle: string | null;
  bookmarked: boolean;
  fullscreen: { active: boolean; supported: boolean; toggle: () => void };
  prefs: BookReaderPrefs;
  hasText: boolean;
  /** "Ko'rinish" menyusi ochiq bo'lganda panel yashirinmasligi uchun. */
  onLookOpenChange: (open: boolean) => void;
  notesOpen: boolean;
  onToggleNotes: () => void;
  onOpenToc: () => void;
  onOpenFind: () => void;
  onToggleBookmark: () => void;
}

/** Ingichka tepa panel: orqaga, kitob nomi va bo'lim, mundarija, qidiruv, xatcho'p, ko'rinish, to'liq ekran. */
export function ReaderTopBar({
  visible,
  bookId,
  title,
  chapterTitle,
  bookmarked,
  fullscreen,
  prefs,
  hasText,
  onLookOpenChange,
  notesOpen,
  onToggleNotes,
  onOpenToc,
  onOpenFind,
  onToggleBookmark,
}: TopBarProps) {
  const t = useTranslations("books.reader");
  const keys = useTranslations("books.reader.keys");

  return (
    <header
      aria-label={t("toolbar")}
      className={cn(BAR, "top-0", !visible && "-translate-y-full")}
      data-hidden={!visible || undefined}
    >
      <Link
        href={bookPath(bookId)}
        className={BK_ICON_BUTTON}
        aria-label={t("back")}
        title={t("back")}
      >
        <ArrowLeft className="size-5" aria-hidden />
      </Link>
      <div className="min-w-0 flex-1 px-1">
        <p className="truncate text-[0.9375rem] leading-tight font-semibold">{title}</p>
        {chapterTitle && (
          <p className="text-bk-muted truncate text-xs leading-tight">{chapterTitle}</p>
        )}
      </div>
      <button
        type="button"
        className={BK_ICON_BUTTON}
        onClick={onOpenToc}
        aria-label={t("toc")}
        title={withKey(t("toc"), keys("toc"))}
      >
        <List className="size-5" aria-hidden />
      </button>
      <button
        type="button"
        className={BK_ICON_BUTTON}
        onClick={onOpenFind}
        aria-label={t("search")}
        title={withKey(t("search"), keys("search"))}
      >
        <Search className="size-5" aria-hidden />
      </button>
      <button
        type="button"
        className={BK_ICON_BUTTON}
        onClick={onToggleBookmark}
        aria-pressed={bookmarked}
        aria-label={bookmarked ? t("bookmarkRemove") : t("bookmarkAdd")}
        title={withKey(bookmarked ? t("bookmarkRemove") : t("bookmarkAdd"), keys("bookmark"))}
      >
        {bookmarked ? (
          <BookmarkCheck className="size-5" aria-hidden />
        ) : (
          <Bookmark className="size-5" aria-hidden />
        )}
      </button>
      <button
        type="button"
        className={BK_ICON_BUTTON}
        onClick={onToggleNotes}
        aria-pressed={notesOpen}
        aria-label={notesOpen ? t("notesClose") : t("notesOpen")}
        title={withKey(notesOpen ? t("notesClose") : t("notesOpen"), keys("notes"))}
      >
        <NotebookPen className="size-5" aria-hidden />
      </button>
      <AppearanceMenu
        prefs={prefs}
        hasText={hasText}
        label={t("appearance")}
        onOpenChange={onLookOpenChange}
      />
      {fullscreen.supported && (
        <button
          type="button"
          className={cn(BK_ICON_BUTTON, "hidden sm:inline-flex")}
          onClick={fullscreen.toggle}
          aria-pressed={fullscreen.active}
          aria-label={fullscreen.active ? t("exitFullscreen") : t("fullscreen")}
          title={withKey(
            fullscreen.active ? t("exitFullscreen") : t("fullscreen"),
            keys("fullscreen"),
          )}
        >
          {fullscreen.active ? (
            <Minimize className="size-5" aria-hidden />
          ) : (
            <Maximize className="size-5" aria-hidden />
          )}
        </button>
      )}
    </header>
  );
}

export interface BottomBarProps {
  visible: boolean;
  page: number;
  total: number;
  chapterTitle: (page: number) => string | null;
  /** `null` — zoom boshqaruvi ko'rsatilmaydi (matn rejimi). */
  zoom: number | null;
  onZoom: (direction: 1 | -1) => void;
  onZoomReset: () => void;
  onGo: (page: number) => void;
}

/** Pastki panel: oldingi/keyingi, bet raqami, bet slayderi (bo'lim nomi bilan), zoom. */
export function ReaderBottomBar({
  visible,
  page,
  total,
  chapterTitle,
  zoom,
  onZoom,
  onZoomReset,
  onGo,
}: BottomBarProps) {
  const t = useTranslations("books.reader");
  const keys = useTranslations("books.reader.keys");
  // Slayderni sudrash paytida bet o'zgarmaydi (har qadamda rasm yuklanmasin): qo'yib yuborilganda o'tadi.
  const [scrub, setScrub] = useState<number | null>(null);
  const shown = scrub ?? page;
  const chapter = chapterTitle(shown);

  const commit = () => {
    if (scrub !== null && scrub !== page) onGo(scrub);
    setScrub(null);
  };

  return (
    <footer
      className={cn(BAR, "bottom-0 border-t border-b-0", !visible && "translate-y-full")}
      data-hidden={!visible || undefined}
    >
      <button
        type="button"
        className={BK_ICON_BUTTON}
        onClick={() => onGo(page - 1)}
        disabled={page <= 1}
        aria-label={t("prev")}
        title={withKey(t("prev"), keys("prev"))}
      >
        <ChevronLeft className="size-5" aria-hidden />
      </button>

      <PageNumberInput
        page={page}
        total={total}
        onGo={onGo}
        className="text-bk-ink bg-transparent"
      />

      <div className="relative flex min-w-0 flex-1 items-center px-2">
        <input
          type="range"
          min={1}
          max={Math.max(total, 1)}
          step={1}
          value={shown}
          onChange={(event) => setScrub(Number(event.target.value))}
          onPointerUp={commit}
          onKeyUp={commit}
          onBlur={commit}
          aria-label={t("slider")}
          aria-valuetext={t("sliderValue", { page: shown, chapter: chapter ?? "" }).replace(
            / · $/,
            "",
          )}
          className="accent-bk-accent h-11 w-full cursor-pointer"
        />
        {scrub !== null && (
          <span
            role="status"
            className="bg-bk-ink text-bk-paper pointer-events-none absolute -top-9 left-1/2 max-w-[80%] -translate-x-1/2 truncate rounded-md px-2.5 py-1 text-xs font-medium shadow-lg"
          >
            {chapter ? t("sliderValue", { page: shown, chapter }) : `${shown}`}
          </span>
        )}
      </div>

      <span className="text-bk-muted hidden w-24 shrink-0 text-right text-xs tabular-nums md:block">
        {t("percent", { percent: progressPercent(page, total) })}
      </span>

      {zoom !== null && (
        <div className="hidden items-center sm:flex">
          <button
            type="button"
            className={BK_ICON_BUTTON}
            onClick={() => onZoom(-1)}
            disabled={zoom <= 1}
            aria-label={t("zoomOut")}
            title={withKey(t("zoomOut"), keys("zoomOut"))}
          >
            <Minus className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onZoomReset}
            title={t("zoomReset")}
            className="hover:bg-bk-accent-soft h-11 min-w-12 rounded-lg px-1 text-sm tabular-nums transition-colors"
          >
            {zoom === 1 ? t("zoomReset") : formatZoom(zoom)}
          </button>
          <button
            type="button"
            className={BK_ICON_BUTTON}
            onClick={() => onZoom(1)}
            disabled={zoom >= 3}
            aria-label={t("zoomIn")}
            title={withKey(t("zoomIn"), keys("zoomIn"))}
          >
            <Plus className="size-4" aria-hidden />
          </button>
        </div>
      )}

      <button
        type="button"
        className={BK_ICON_BUTTON}
        onClick={() => onGo(page + 1)}
        disabled={page >= total}
        aria-label={t("next")}
        title={withKey(t("next"), keys("next"))}
      >
        <ChevronRight className="size-5" aria-hidden />
      </button>
    </footer>
  );
}
