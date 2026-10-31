"use client";

import { useTranslations } from "next-intl";
import { useBookProgressMap } from "@/hooks/useBookProgressMap";
import { progressPercent } from "@/lib/books/reader";

/**
 * Kartaning muqovasi pastidagi o'qish chizig'i (muqova ustida: joy egallamaydi, layout sakramaydi).
 * Hali o'qilmagan bo'lsa hech narsa chizilmaydi.
 */
export function BookCardProgress({ bookId, pageCount }: { bookId: string; pageCount: number }) {
  const t = useTranslations("books.card");
  const lastPage = useBookProgressMap().get(bookId);
  if (!lastPage || lastPage <= 1) return null;
  const percent = progressPercent(lastPage, pageCount);

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-label={t("progress", { percent })}
      title={`${t("progress", { percent })} · ${t("continue", { page: lastPage })}`}
      className="pointer-events-none absolute inset-x-2 bottom-2 h-1.5 overflow-hidden rounded-full bg-black/35 backdrop-blur-sm"
    >
      <div className="bg-accent h-full rounded-full" style={{ width: `${percent}%` }} />
    </div>
  );
}
