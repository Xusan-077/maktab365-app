import type { MetadataRoute } from "next";
import { locales } from "@/lib/i18n/config";
import { SITE_URL } from "@/lib/i18n/seo";
import { getAllBooks } from "@/lib/pdf-books/server";
import { absoluteUrl } from "@/lib/seo/jsonld";
import { GRADES } from "@/types/catalog";
import { gradePath, pdfBookPath, ROUTES } from "@/lib/utils/routes";

type Entry = { path: string; lastModified?: string; priority: number };

/** Har sahifa barcha tillarda; har til yozuvida boshqa tillar `alternates` sifatida. */
function localized({ path, lastModified, priority }: Entry): MetadataRoute.Sitemap {
  const languages = Object.fromEntries(
    locales.map((locale) => [locale, absoluteUrl(SITE_URL, locale, path)]),
  );
  return locales.map((locale) => ({
    url: absoluteUrl(SITE_URL, locale, path),
    ...(lastModified ? { lastModified } : {}),
    priority,
    alternates: { languages },
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const books = await getAllBooks();
  const entries: Entry[] = [
    { path: ROUTES.home, priority: 1 },
    { path: ROUTES.textbooks, priority: 0.9 },
    { path: ROUTES.subjects, priority: 0.8 },
    { path: ROUTES.about, priority: 0.3 },
    { path: ROUTES.help, priority: 0.3 },
    // Sinf sahifasi yo'q — kanonik manzil katalog filtri (`/darsliklar?sinf=N`).
    ...GRADES.map((grade) => ({ path: gradePath(grade), priority: 0.8 })),
    ...books.map((book) => ({
      path: pdfBookPath(book),
      lastModified: book.published_at ?? undefined,
      priority: 0.7,
    })),
  ];
  return entries.flatMap(localized);
}
