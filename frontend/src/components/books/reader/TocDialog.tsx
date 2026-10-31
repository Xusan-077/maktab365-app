"use client";

import { Bookmark, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Tabs } from "@/components/ui/Tabs";
import type { BookChapter } from "@/lib/books/api";
import { currentChapter } from "@/lib/books/reader";
import { cn } from "@/lib/utils/cn";

const ROW =
  "hover:bg-subtle flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-[0.9375rem] transition-colors";

export interface TocDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chapters: readonly BookChapter[];
  bookmarks: readonly number[];
  page: number;
  onGo: (page: number) => void;
  onRemoveBookmark: (page: number) => void;
  /** Ochilganda qaysi tab: mundarija yoki xatcho'plar. */
  tab: "contents" | "bookmarks";
  onTabChange: (tab: "contents" | "bookmarks") => void;
}

/** Chap panel: mundarija (joriy bo'lim belgilanadi) va xatcho'plar; tanlansa o'sha betga o'tadi. */
export function TocDialog({
  open,
  onOpenChange,
  chapters,
  bookmarks,
  page,
  onGo,
  onRemoveBookmark,
  tab,
  onTabChange,
}: TocDialogProps) {
  const t = useTranslations("books.reader.tocPanel");
  const current = currentChapter(chapters, page);

  const go = (target: number) => {
    onGo(target);
    onOpenChange(false);
  };

  const contents =
    chapters.length === 0 ? (
      <p className="text-muted py-6 text-center text-sm">{t("noContents")}</p>
    ) : (
      <ul className="flex flex-col">
        {chapters.map((chapter) => {
          const isCurrent = current?.id === chapter.id;
          return (
            <li key={chapter.id}>
              <button
                type="button"
                onClick={() => go(chapter.start_page)}
                aria-current={isCurrent ? "location" : undefined}
                className={cn(ROW, isCurrent && "bg-primary-soft text-link font-semibold")}
              >
                <span className="min-w-0">{chapter.title}</span>
                <span className="text-muted shrink-0 text-sm tabular-nums">
                  {t("page", { page: chapter.start_page })}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    );

  const saved =
    bookmarks.length === 0 ? (
      <EmptyState icon={Bookmark}>{t("noBookmarks")}</EmptyState>
    ) : (
      <ul className="flex flex-col">
        {bookmarks.map((number) => {
          const chapter = currentChapter(chapters, number);
          return (
            <li key={number} className="flex items-center gap-1">
              <button type="button" onClick={() => go(number)} className={ROW}>
                <span className="min-w-0">
                  <span className="block font-medium">{t("page", { page: number })}</span>
                  {chapter && (
                    <span className="text-muted block truncate text-sm">{chapter.title}</span>
                  )}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onRemoveBookmark(number)}
                aria-label={t("removeBookmark", { page: number })}
                className="text-muted hover:bg-subtle hover:text-foreground inline-flex size-11 shrink-0 items-center justify-center rounded-lg transition-colors"
              >
                <X className="size-4" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t("title")} placement="left">
      <Tabs
        label={t("tabs")}
        value={tab}
        onValueChange={(id) => onTabChange(id === "bookmarks" ? "bookmarks" : "contents")}
        items={[
          { id: "contents", label: t("tabContents"), content: contents },
          {
            id: "bookmarks",
            label: `${t("tabBookmarks")}${bookmarks.length > 0 ? ` (${bookmarks.length})` : ""}`,
            content: saved,
          },
        ]}
      />
    </Dialog>
  );
}
