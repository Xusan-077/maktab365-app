"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { isBookRead, usePdfProgressMap } from "@/hooks/usePdfProgressMap";
import { readFraction } from "@/components/pdf/PdfBookCard";

interface BookProgressProps {
  bookId: string;
  pageCount: number;
}

/** Kitob bo'yicha o'qish holati; progress ma'lumoti bitta umumiy manbadan (kirgan: 1 so'rov, mehmon: localStorage). */
function useBookProgress({ bookId, pageCount }: BookProgressProps) {
  const entry = usePdfProgressMap()[bookId];
  const read = isBookRead(entry, pageCount);
  return { entry, read, fraction: readFraction(entry?.page, pageCount, read) };
}

/** Muqova pastidagi 3px progress chizig'i (o'qishni boshlagan kitoblarda). */
export function BookCoverProgress(props: BookProgressProps) {
  const { fraction } = useBookProgress(props);
  if (fraction <= 0) return null;
  return (
    <span
      aria-hidden
      className="rounded-b-cover bg-foreground/20 pointer-events-none absolute inset-x-0 bottom-0 h-[3px] overflow-hidden"
    >
      <span className="bg-brand block h-full" style={{ width: `${Math.round(fraction * 100)}%` }} />
    </span>
  );
}

/** Meta qatoriga qo'shimcha: "· 45-bet" yoki "✓ O'qilgan". */
export function BookMetaProgress(props: BookProgressProps) {
  const t = useTranslations("site.bookCard");
  const { entry, read } = useBookProgress(props);
  if (read) {
    return (
      <span className="text-success inline-flex items-center gap-1 font-semibold whitespace-nowrap">
        {" · "}
        <Check className="size-3.5" aria-hidden />
        {t("read")}
      </span>
    );
  }
  if (!entry || entry.page < 1) return null;
  return <span className="whitespace-nowrap">{` · ${t("page", { page: entry.page })}`}</span>;
}
