"use client";

import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import type { PdfBook } from "@/lib/pdf-books/api";
import { coverTone } from "@/lib/pdf/cover-theme";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { cn } from "@/lib/utils/cn";

/**
 * Kitob muqovasi (3:4). Rasm bo'lmasa fan rangida: tepada "5-SINF", pastda fan nomi.
 * Bezak: o'qish uchun emas, shuning uchun ekran o'qigichdan yashirilgan.
 */
export function CoverTile({
  book,
  width,
  height,
  compact = false,
  className,
}: {
  book: PdfBook;
  width: number;
  height: number;
  compact?: boolean;
  className?: string;
}) {
  const t = useTranslations("login");
  const locale = useLocale() as Locale;
  return (
    <div
      aria-hidden
      style={{ width, height }}
      className={cn(
        "relative shrink-0 overflow-hidden rounded-[10px] bg-white shadow-[0_18px_40px_rgba(3,14,40,.35)]",
        className,
      )}
    >
      {book.cover ? (
        <Image
          src={book.cover}
          alt=""
          fill
          unoptimized
          sizes={`${width}px`}
          className="object-cover"
        />
      ) : (
        <div
          className="cover absolute inset-0 flex flex-col justify-between p-3.5"
          data-tone={coverTone(book.subject)}
        >
          <span
            className={cn("font-bold tracking-[.08em]", compact ? "text-[9px]" : "text-[12px]")}
          >
            {t("coverGrade", { grade: book.grade })}
          </span>
          <span
            className={cn(
              "leading-tight font-extrabold break-words",
              compact ? "text-[13px]" : "text-[22px]",
            )}
          >
            {getLocalized(book.subject_title, locale)}
          </span>
        </div>
      )}
    </div>
  );
}
