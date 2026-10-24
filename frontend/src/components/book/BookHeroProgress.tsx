"use client";

import { useTranslations } from "next-intl";
import { readFraction } from "@/components/pdf/PdfBookCard";
import { isBookRead, usePdfProgressMap } from "@/hooks/usePdfProgressMap";

/** "Siz 45-betda to'xtagansiz · 28%" va progress chizig'i; o'qishni boshlamagan foydalanuvchiga ko'rinmaydi. */
export function BookHeroProgress({ bookId, pageCount }: { bookId: string; pageCount: number }) {
  const t = useTranslations("pdfBooks.page");
  const entry = usePdfProgressMap()[bookId];
  const read = isBookRead(entry, pageCount);
  const fraction = readFraction(entry?.page, pageCount, read);
  if (!entry || fraction <= 0) return null;
  const percent = Math.round(fraction * 100);
  const label = read ? t("progressDone") : t("progressAt", { page: entry.page });

  return (
    <div className="flex max-w-[38.75rem] flex-col gap-2.5">
      <div className="text-muted flex justify-between gap-4 text-sm">
        <span>{label}</span>
        <span className="tabular-nums">{percent}%</span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={label}
        className="bg-brand-soft h-2 overflow-hidden rounded-full"
      >
        <div className="bg-brand h-full rounded-full" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
