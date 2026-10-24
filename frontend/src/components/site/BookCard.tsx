import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { Link } from "@/lib/i18n/navigation";
import type { PdfBook } from "@/lib/pdf-books/api";
import { pdfBookPath } from "@/lib/utils/routes";
import { BookCover } from "./BookCover";

export interface BookCardProps {
  book: PdfBook;
  /** Ta'lim tili (`uz` | `ru` | `en`): ro'yxat API'sida yo'q, bor joyda beriladi. */
  language?: string;
  priority?: boolean;
  sizes?: string;
}

/** Katalog kartasi: muqova + nom + "9-sinf · O'zbekcha". Butun karta — bitta havola. */
export function BookCard({ book, language, priority, sizes }: BookCardProps) {
  const t = useTranslations("site");
  const locale = useLocale() as Locale;
  const title = getLocalized(book.title, locale);
  const languageLabel =
    language && t.has(`language.${language}`) ? t(`language.${language}`) : null;
  const meta = [t("gradeLabel", { grade: book.grade }), languageLabel].filter(Boolean).join(" · ");

  return (
    <Link href={pdfBookPath(book)} className="group flex flex-col gap-3 rounded-xl">
      <BookCover
        grade={book.grade}
        title={getLocalized(book.subject_title, locale)}
        group={book.subject_group}
        src={book.cover}
        priority={priority}
        sizes={sizes}
        className="transition-transform duration-200 motion-safe:group-hover:-translate-y-0.5"
      />
      <span className="flex flex-col gap-1">
        <span className="text-foreground text-base font-bold">{title}</span>
        <span className="text-muted text-sm">{meta}</span>
      </span>
    </Link>
  );
}
