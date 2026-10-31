"use client";

import { useState, type CSSProperties } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { BOOK_TYPE_GROUP } from "@/lib/books/filters";
import type { BookType } from "@/lib/books/api";
import { groupColor } from "@/lib/subject-colors";
import { cn } from "@/lib/utils/cn";

export interface BookCoverProps {
  title: string;
  type: BookType;
  /** Muqova rasmi (WebP); yo'q yoki yuklanmasa tur rangidagi zaxira qoladi. */
  src?: string | null;
  /** Birinchi ekrandagi muqova (LCP): darrov yuklanadi. */
  priority?: boolean;
  sizes?: string;
  className?: string;
}

/**
 * Kitob muqovasi, nisbat 2:3. Zaxira (tekis tur rangi, kitob "umurtqasi", nom) rasm ostida doim
 * turadi: rasm yuklanguncha joy egallaydi (layout sakramaydi), xato bersa shu qoladi.
 */
export function BookCover({
  title,
  type,
  src,
  priority = false,
  sizes = "(min-width: 1024px) 200px, 45vw",
  className,
}: BookCoverProps) {
  const t = useTranslations("books");
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = Boolean(src) && failedSrc !== src;
  const fallbackStyle: CSSProperties = {
    backgroundColor: groupColor(BOOK_TYPE_GROUP[type]).vars.color,
    color: "var(--on-group)",
  };

  return (
    <div
      className={cn(
        "bg-surface-2 rounded-cover shadow-cover relative aspect-[2/3] w-full overflow-hidden",
        className,
      )}
    >
      <div
        data-testid="book-cover-fallback"
        style={fallbackStyle}
        className="absolute inset-0 flex flex-col justify-between p-4 pl-6"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-[6%] bg-black/15"
        />
        <span className="relative text-xs font-semibold opacity-90">{t(`typeName.${type}`)}</span>
        <span className="relative line-clamp-5 text-lg leading-tight font-extrabold [overflow-wrap:anywhere]">
          {title}
        </span>
      </div>
      {showImage && src && (
        <Image
          src={src}
          unoptimized
          alt={t("cover", { title })}
          fill
          priority={priority}
          sizes={sizes}
          onError={() => setFailedSrc(src)}
          className="object-cover"
        />
      )}
    </div>
  );
}
