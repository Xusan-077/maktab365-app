"use client";

import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/Skeleton";
import { useBookContentsProgress } from "@/hooks/useBookContentsProgress";
import type { BookContents } from "@/lib/pdf/book-contents";
import { cn } from "@/lib/utils/cn";

/** "Bob bo'yicha o'zlashtirish": har bob uchun rim raqami, 8px progress va foiz. */
export function ChapterMastery({ bookId, contents }: { bookId: string; contents: BookContents }) {
  const t = useTranslations("pdfBooks.contents.mastery");
  const { ready, progress } = useBookContentsProgress(bookId, contents);
  if (contents.chapters.length === 0) return null;
  return (
    <section
      aria-labelledby="book-mastery"
      data-testid="contents-mastery"
      className="border-ds-line bg-ds-surface font-ui flex flex-col gap-4 rounded-[24px] border p-5"
    >
      <h2 id="book-mastery" className="text-ds-ink text-base font-extrabold">
        {t("title")}
      </h2>
      <ul className="flex flex-col gap-3">
        {contents.chapters.map((chapter) => {
          const entry = progress.chapters.get(chapter.id);
          const percent = ready ? (entry?.percent ?? 0) : 0;
          return (
            <li key={chapter.id} className="flex items-center gap-3">
              <span className="text-ds-muted w-9 shrink-0 text-sm font-extrabold">
                {chapter.roman}
              </span>
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={ready ? percent : undefined}
                aria-label={`${t("item", { roman: chapter.roman })}: ${chapter.name}`}
                className="bg-ds-line h-2 min-w-0 flex-1 overflow-hidden rounded-full"
              >
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none",
                    entry?.state === "done" ? "bg-ds-ok" : "bg-ds-accent",
                  )}
                  style={{ width: `${percent}%` }}
                />
              </div>
              <span className="text-ds-ink-2 flex h-5 w-11 shrink-0 items-center justify-end text-sm font-bold tabular-nums">
                {ready ? `${percent}%` : <Skeleton className="h-4 w-8" />}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
