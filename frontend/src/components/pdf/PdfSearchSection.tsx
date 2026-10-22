"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { usePdfProgressMap } from "@/hooks/usePdfProgressMap";
import { SEARCH_MIN_LENGTH } from "@/lib/api/queries";
import { pdfQueries } from "@/lib/pdf-books/queries";
import { PdfBookCard } from "./PdfBookCard";

/** Qidiruv natijalariga qo'shimcha: nomi mos kelgan PDF darsliklar (hech narsa topilmasa ko'rinmaydi). */
export function PdfSearchSection({ query }: { query: string }) {
  const t = useTranslations("pdfBooks.search");
  const resume = usePdfProgressMap();
  const { data } = useQuery({
    ...pdfQueries.list({ q: query }),
    enabled: query.trim().length >= SEARCH_MIN_LENGTH,
  });
  const books = data?.results ?? [];
  if (books.length === 0) return null;
  return (
    <section aria-labelledby="search-pdf-books" className="flex flex-col gap-3">
      <h2 id="search-pdf-books" className="text-xl font-semibold">
        {t("title")}
      </h2>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="search-pdf-books">
        {books.map((book) => (
          <li key={book.id}>
            <PdfBookCard book={book} resumePage={resume[book.id]} />
          </li>
        ))}
      </ul>
    </section>
  );
}
