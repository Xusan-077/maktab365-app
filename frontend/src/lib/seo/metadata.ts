import type { Metadata } from "next";
import type { Locale } from "@/lib/i18n/config";
import { getAlternates, OG_IMAGES, SITE_URL } from "@/lib/i18n/seo";

/** Brauzer sarlavhasi chegarasi (qidiruv natijasida kesilmasin) — shablon qo'shimchasi bilan birga. */
export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 155;
/** `layout.tsx` dagi shablon: `%s | darslik365`. */
export const TITLE_SUFFIX = " | darslik365";

/** Qidiruvga yopiq sahifalar (o'qish oynasi, shaxsiy bo'limlar, kirish, admin). */
export const NOINDEX: NonNullable<Metadata["robots"]> = { index: false, follow: false };

/** `og:locale` qiymatlari (Open Graph `ll_CC` ko'rinishida). */
export const OG_LOCALES: Record<Locale, string> = {
  uz: "uz_UZ",
  "uz-Cyrl": "uz_UZ",
  ru: "ru_RU",
  en: "en_US",
};

/** So'z chegarasida "…" bilan qisqartiradi (`max` belgidan oshmaydi). */
export function clamp(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:–—-]+$/, "")}…`;
}

/** Sahifa sarlavhasi: shablon qo'shimchasi (` | darslik365`) bilan birga 60 belgidan oshmaydi. */
export const clampTitle = (title: string) => clamp(title, TITLE_MAX - TITLE_SUFFIX.length);
export const clampDescription = (description: string) => clamp(description, DESCRIPTION_MAX);

export interface SeoImage {
  url: string;
  width: number;
  height: number;
  alt?: string;
}

export interface PageSeo {
  locale: Locale;
  /** Tilsiz yo'l (`/darsliklar`, `/` — bosh sahifa). */
  path: string;
  title: string;
  description: string;
  /** Berilmasa — saytning umumiy 1200×630 rasmi. */
  image?: SeoImage;
  /** Meta keywords (tabiiy kalit so'zlar; ortiqcha takrorlamang). */
  keywords?: readonly string[];
  type?: "website" | "book";
  noindex?: boolean;
  /** Sarlavhaga shablon qo'shimchasi qo'shilmasin (bosh sahifa). */
  absoluteTitle?: boolean;
}

/**
 * Bitta joydan: title/description (chegaralangan), canonical + hreflang, Open Graph, Twitter,
 * `og:locale`, keywords va (kerak bo'lsa) noindex. Sahifa `openGraph` ni o'zi belgilasa layout'dagisi
 * qo'shilmaydi, shuning uchun bu yerda hammasi to'liq beriladi.
 */
export function buildMetadata(seo: PageSeo): Metadata {
  const title = clampTitle(seo.title);
  const description = clampDescription(seo.description);
  const alternates = getAlternates(seo.locale, seo.path);
  const images = seo.image ? [seo.image] : OG_IMAGES;
  const ogTitle = seo.absoluteTitle ? title : `${title}${TITLE_SUFFIX}`;
  return {
    title: seo.absoluteTitle ? { absolute: title } : title,
    description,
    ...(seo.keywords?.length ? { keywords: [...seo.keywords] } : {}),
    alternates,
    openGraph: {
      type: seo.type ?? "website",
      siteName: "darslik365",
      title: ogTitle,
      description,
      url: `${SITE_URL}${String(alternates.canonical)}`,
      locale: OG_LOCALES[seo.locale],
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description,
      images: images.map((image) => image.url),
    },
    ...(seo.noindex ? { robots: NOINDEX } : {}),
  };
}

/** `meta.keywords` (vergul bilan ajratilgan) → massiv. */
export const splitKeywords = (value: string): string[] =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
