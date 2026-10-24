"use client";

import { useState, type CSSProperties } from "react";
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
  // Ikkala variant (300px / 600px WebP) bor bo'lsa Next `sizes` bo'yicha srcset tuzadi, har kenglik
  // mos variantga bog'lanadi. Aks holda bitta URL: `unoptimized` — srcset ham, kenglik parametri
  // ham yo'q (R2/CDN uni baribir e'tiborsiz qoldiradi, faqat kesh kalitini bo'laklaydi).
  const hasVariants = Boolean(srcSmall && srcLarge);
  const loader = ({ width }: ImageLoaderProps) =>
    (width <= SMALL_MAX_WIDTH ? srcSmall : srcLarge) ?? primary ?? "";
  const small = size === "sm";
  // Gradient guruh rangidan inline hosil qilinadi (token o'zgaruvchisi): `bg-*` klassiga bog'liq emas,
  // shuning uchun stil fayli eskirgan bo'lsa ham zaxira bo'sh ko'rinmaydi. Dark rejimda ham mos.
  const color = groupColor(group).vars.color;
  const fallbackStyle: CSSProperties = {
    backgroundColor: color,
    backgroundImage: `linear-gradient(150deg, color-mix(in oklab, ${color} 82%, white) 0%, ${color} 48%, color-mix(in oklab, ${color} 74%, black) 100%)`,
    color: "var(--on-group)",
  };

  return (
    <div
      className={cn(
        "bg-surface-2 rounded-cover shadow-cover relative aspect-[3/4] w-full overflow-hidden",
        className,
      )}
    >
      <div
        data-testid="book-cover-fallback"
        style={fallbackStyle}
        className={cn(
          "absolute inset-0 flex flex-col justify-between overflow-hidden",
          small ? "p-2 pl-3" : "p-4 pl-5",
        )}
      >
        {/* Bezak: yumshoq doiralar va kitob "umurtqasi" (gradient ustida, matn ostida). */}
        <span
          aria-hidden
          className="pointer-events-none absolute -top-[18%] -right-[22%] size-[62%] rounded-full bg-white/15"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-[26%] -left-[30%] size-[75%] rounded-full bg-black/10"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-[5%] bg-black/15"
        />
        <span
          className={cn(
            "relative self-start rounded-full bg-black/15 font-bold tracking-[0.08em] uppercase",
            small ? "px-1.5 py-px text-[0.5rem]" : "px-2.5 py-1 text-xs",
          )}
        >
          {t("grade", { grade })}
        </span>
        <span
          className={cn(
            "relative font-extrabold [overflow-wrap:anywhere]",
            small
              ? "line-clamp-3 text-xs leading-tight"
              : "line-clamp-4 text-[1.3125rem] leading-[1.08]",
          )}
        >
          {title}
        </span>
      </div>
      {showImage && primary && (
        <Image
          src={primary}
          {...(hasVariants ? { loader } : { unoptimized: true })}
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
