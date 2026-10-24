"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { groupColor } from "@/lib/subject-colors";
import { cn } from "@/lib/utils/cn";

export interface BookCoverProps {
  grade: number;
  /** Fan nomi (fallback muqovada pastda ko'rinadi). */
  title: string;
  /** Backend `subject_group`; noma'lum bo'lsa brend ko'ki. */
  group?: string | null;
  /** Admin tanlagan muqova (R2 URL); bo'lmasa yoki yuklanmasa — guruh rangidagi zaxira. */
  src?: string | null;
  /** `sm` — 72×96 kabi kichik muqova (matn kichrayadi). */
  size?: "sm" | "md";
  /** Birinchi ekrandagi muqova (LCP): darrov yuklanadi. */
  priority?: boolean;
  sizes?: string;
  className?: string;
}

/**
 * Darslik muqovasi, nisbat 3:4. Zaxira (guruh rangi, tepada "9-SINF", pastda fan nomi) rasm ostida
 * doim turadi: rasm yuklanguncha o'rin egallaydi (layout shift yo'q), xato bersa shu qoladi.
 */
export function BookCover({
  grade,
  title,
  group,
  src,
  size = "md",
  priority = false,
  sizes = "(min-width: 768px) 200px, 45vw",
  className,
}: BookCoverProps) {
  const t = useTranslations("site.cover");
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = Boolean(src) && failedSrc !== src;
  const small = size === "sm";

  return (
    <div
      className={cn(
        "bg-surface-2 rounded-cover shadow-cover relative aspect-[3/4] w-full overflow-hidden",
        className,
      )}
    >
      <div
        className={cn(
          "text-on-group absolute inset-0 flex flex-col justify-between",
          groupColor(group).solid,
          small ? "p-2" : "p-4",
        )}
      >
        <span
          className={cn(
            "font-bold tracking-[0.08em] uppercase",
            small ? "text-[0.5rem]" : "text-xs",
          )}
        >
          {t("grade", { grade })}
        </span>
        <span
          className={cn(
            "font-extrabold",
            small ? "text-xs leading-tight" : "text-[1.3125rem] leading-[1.08]",
          )}
        >
          {title}
        </span>
      </div>
      {showImage && src && (
        <Image
          src={src}
          alt=""
          fill
          unoptimized
          priority={priority}
          sizes={sizes}
          onError={() => setFailedSrc(src)}
          className="object-cover"
        />
      )}
    </div>
  );
}
