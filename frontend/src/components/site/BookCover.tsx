"use client";

import { useState } from "react";
import Image, { type ImageLoaderProps } from "next/image";
import { useTranslations } from "next-intl";
import { groupColor } from "@/lib/subject-colors";
import { cn } from "@/lib/utils/cn";

export interface BookCoverProps {
  grade: number;
  /** Fan nomi (fallback muqovada pastda ko'rinadi). */
  title: string;
  /** Backend `subject_group`; noma'lum bo'lsa brend ko'ki. */
  group?: string | null;
  /** Asl muqova (R2 URL, zaxira); hech biri bo'lmasa yoki yuklanmasa — guruh rangidagi zaxira. */
  src?: string | null;
  /** 300px WebP (ro'yxat API'si `cover_small`): kichik ko'rsatishlarda tanlanadi. */
  srcSmall?: string | null;
  /** 600px WebP (detail API'si `cover_large`): katta ko'rsatishlar va retina ekranlar uchun. */
  srcLarge?: string | null;
  /** `sm` — 72×96 kabi kichik muqova (matn kichrayadi). */
  size?: "sm" | "md";
  /** Birinchi ekrandagi muqova (LCP): darrov yuklanadi. */
  priority?: boolean;
  sizes?: string;
  className?: string;
}

/** Brauzer so'ragan kenglik shundan oshmasa 300px variant yetarli (160px karta @2x = 320). */
const SMALL_MAX_WIDTH = 320;

/**
 * Darslik muqovasi, nisbat 3:4. Zaxira (guruh rangi, tepada "9-SINF", pastda fan nomi) rasm ostida
 * doim turadi: rasm yuklanguncha o'rin egallaydi (layout shift yo'q), xato bersa shu qoladi.
 */
export function BookCover({
  grade,
  title,
  group,
  src,
  srcSmall,
  srcLarge,
  size = "md",
  priority = false,
  sizes = "(min-width: 768px) 200px, 45vw",
  className,
}: BookCoverProps) {
  const t = useTranslations("site.cover");
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  // Asl rasm — eng ishonchli zaxira; variantlar yo'q (eski kitoblar) bo'lsa shu ishlatiladi.
  const primary = srcLarge ?? src ?? srcSmall ?? null;
  const showImage = primary !== null && failedSrc !== primary;
  // `sizes` bo'yicha Next srcset tuzadi, bu yerda har kenglik mos variantga bog'lanadi.
  const loader = ({ width }: ImageLoaderProps) =>
    (width <= SMALL_MAX_WIDTH ? (srcSmall ?? src ?? srcLarge) : (srcLarge ?? src ?? srcSmall)) ??
    "";
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
      {showImage && primary && (
        <Image
          src={primary}
          loader={loader}
          alt=""
          fill
          priority={priority}
          sizes={sizes}
          onError={() => setFailedSrc(primary)}
          className="object-cover"
        />
      )}
    </div>
  );
}
