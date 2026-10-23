import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import type { PdfBook, PdfBookDetail } from "@/lib/pdf-books/api";
import { gradePath, pdfBookPath } from "@/lib/utils/routes";

export interface Crumb {
  name: string;
  /** Tilsiz yo'l (`/darsliklar/9`); oxirgi element uchun ham beriladi. */
  path: string;
}

/** Tilga mos to'liq URL. */
export function absoluteUrl(site: string, locale: Locale, path: string): string {
  return `${site.replace(/\/+$/, "")}/${locale}${path === "/" ? "" : path}`;
}

export function breadcrumbList(site: string, locale: Locale, crumbs: Crumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(site, locale, crumb.path),
    })),
  };
}

export function bookItemList(site: string, locale: Locale, name: string, books: PdfBook[]) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name,
    numberOfItems: books.length,
    itemListElement: books.map((book, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: getLocalized(book.title, locale),
      url: absoluteUrl(site, locale, pdfBookPath(book)),
    })),
  };
}

/** `Book` (o'quv qo'llanma) — faqat haqiqiy maydonlar; tavsif/rasm bo'sh bo'lsa yozilmaydi. */
export function bookJsonLd(
  site: string,
  locale: Locale,
  book: PdfBookDetail,
  subjectTitle: string,
  image?: string | null,
) {
  return {
    "@context": "https://schema.org",
    "@type": "Book",
    name: getLocalized(book.title, locale),
    url: absoluteUrl(site, locale, pdfBookPath(book)),
    inLanguage: book.language ?? "uz",
    bookFormat: "https://schema.org/EBook",
    numberOfPages: book.page_count,
    educationalLevel: String(book.grade),
    about: subjectTitle,
    isAccessibleForFree: true,
    ...(book.description ? { description: book.description } : {}),
    ...(book.published_at ? { datePublished: book.published_at } : {}),
    ...(image ? { image } : {}),
    isPartOf: { "@type": "CollectionPage", url: absoluteUrl(site, locale, gradePath(book.grade)) },
  };
}

/** `<script type="application/ld+json">` ichiga xavfsiz: `<` belgisi qochiriladi. */
export const serializeJsonLd = (data: unknown): string =>
  JSON.stringify(data).replace(/</g, () => "\\" + "u003c");
