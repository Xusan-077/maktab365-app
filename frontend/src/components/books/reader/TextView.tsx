"use client";

import { useEffect, useMemo, useRef, type PointerEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, RotateCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { bookQueries } from "@/lib/books/queries";
import { pagesToPrefetch, toParagraphs, type BookReaderPrefs } from "@/lib/books/reader";
import { swipeDirection } from "@/lib/pdf/swipe";
import { cn } from "@/lib/utils/cn";
import { BAR_INSET } from "./reader-styles";

export interface TextViewProps {
  bookId: string;
  page: number;
  total: number;
  prefs: Pick<BookReaderPrefs, "font" | "fontSize" | "lineHeight">;
  onStep: (direction: 1 | -1) => void;
  onTap: () => void;
  onShowPage: () => void;
}

/**
 * Badiiy kitobning matnli rejimi: bet matni (PDF matn qatlamidan), tanlangan shrift, hajm va qator
 * oralig'i bilan. Keyingi 2 betning matni oldindan yuklanadi.
 */
export function TextView({ bookId, page, total, prefs, onStep, onTap, onShowPage }: TextViewProps) {
  const t = useTranslations("books.reader");
  const queryClient = useQueryClient();
  const scroller = useRef<HTMLDivElement>(null);
  const swipeStart = useRef<{ x: number; y: number; at: number } | null>(null);
  const query = useQuery(bookQueries.pageText(bookId, page));
  const paragraphs = useMemo(() => toParagraphs(query.data?.text ?? ""), [query.data]);

  useEffect(() => {
    for (const next of pagesToPrefetch(page, total)) {
      void queryClient.prefetchQuery(bookQueries.pageText(bookId, next));
    }
  }, [bookId, page, total, queryClient]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [page]);

  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType === "mouse") return;
    swipeStart.current = { x: event.clientX, y: event.clientY, at: event.timeStamp };
  };
  const onPointerUp = (event: PointerEvent) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) return;
    const direction = swipeDirection(
      event.clientX - start.x,
      event.clientY - start.y,
      event.timeStamp - start.at,
    );
    if (direction) onStep(direction === "next" ? 1 : -1);
  };

  return (
    <div
      ref={scroller}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onClick={(event) => {
        if (event.target === event.currentTarget) onTap();
      }}
      tabIndex={-1}
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain focus:outline-none"
      style={{ paddingBlock: BAR_INSET }}
    >
      <article
        className={cn(
          "bg-bk-paper text-bk-ink mx-auto my-4 min-h-[60%] w-full max-w-[44rem] rounded-sm px-6 py-10 shadow-[0_1px_2px_rgb(0_0_0/0.08),0_12px_40px_-12px_rgb(0_0_0/0.22)] sm:px-14",
          prefs.font === "serif" ? "font-book" : "font-sans",
        )}
        style={{ fontSize: prefs.fontSize, lineHeight: prefs.lineHeight }}
        aria-busy={query.isPending}
      >
        {query.isPending && (
          <div className="flex flex-col gap-3" role="status" aria-label={t("pageLoading")}>
            {Array.from({ length: 9 }, (_, index) => (
              <Skeleton
                key={index}
                className={cn("bg-bk-line/60 h-[1em]", index % 4 === 3 && "w-2/3")}
              />
            ))}
          </div>
        )}

        {query.isError && (
          <div role="alert" className="text-bk-muted flex flex-col items-start gap-3 text-base">
            {t("textError")}
            <Button variant="secondary" size="sm" onClick={() => void query.refetch()}>
              <RotateCw className="size-4" aria-hidden />
              {t("retry")}
            </Button>
          </div>
        )}

        {query.isSuccess && paragraphs.length === 0 && (
          <div className="text-bk-muted flex flex-col items-start gap-3 font-sans text-base">
            <FileText className="size-7" aria-hidden />
            <p>
              <span className="text-bk-ink block font-semibold">{t("textEmpty")}</span>
              {t("textEmptyHint")}
            </p>
            <Button variant="secondary" size="sm" onClick={onShowPage}>
              {t("switchToPage")}
            </Button>
          </div>
        )}

        {paragraphs.map((paragraph, index) => (
          <p key={index} className="mb-[0.85em] last:mb-0">
            {paragraph}
          </p>
        ))}
      </article>
    </div>
  );
}
