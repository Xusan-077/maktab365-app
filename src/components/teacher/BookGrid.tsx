"use client";

import { useLocale } from "next-intl";
import { BookCard } from "@/components/catalog/BookCard";
import { useSubjects } from "@/hooks/useSubjects";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import type { Book } from "@/types/catalog";
import { BookSaveButton } from "./SaveButtons";

/** Kitob kartochkalari; har birida "Saqlash" tugmasi. */
export function BookGrid({ books }: { books: Book[] }) {
  const locale = useLocale() as Locale;
  const { data: subjects = [] } = useSubjects();
  return (
    <ul className="grid gap-4 xl:grid-cols-2">
      {books.map((book) => {
        const subject = subjects.find((item) => item.id === book.subjectId);
        return (
          <li key={book.id}>
            <BookCard
              book={book}
              locale={locale}
              subjectName={subject?.name ?? book.title}
              actions={<BookSaveButton bookId={book.id} title={getLocalized(book.title, locale)} />}
            />
          </li>
        );
      })}
    </ul>
  );
}
