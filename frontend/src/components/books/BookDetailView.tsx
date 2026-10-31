import { BookOpen } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/Badge";
import { buttonVariants } from "@/components/ui/Button";
import type { BookDetail } from "@/lib/books/api";
import { Link } from "@/lib/i18n/navigation";
import { bookReaderPath } from "@/lib/utils/routes";
import { BookCover } from "./BookCover";

/**
 * Kitob sahifasi: chapda muqova, o'ngda nom, muallif, qisqa ma'lumotlar, "O'qishni boshlash",
 * tavsif va mundarija. Keng bo'sh joy, bitta asosiy harakat.
 */
export function BookDetailView({ book }: { book: BookDetail }) {
  const t = useTranslations("books");
  const td = useTranslations("books.detail");

  const facts = [
    book.grade_level ? t("gradeLabel", { grade: book.grade_level }) : null,
    t(`languages.${book.language}`),
    t("pages", { count: book.page_count }),
  ].filter(Boolean);

  return (
    <div className="grid items-start gap-8 md:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] md:gap-12 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] lg:gap-16">
      <div className="mx-auto w-full max-w-[14rem] md:sticky md:top-24 md:max-w-none">
        <BookCover title={book.title} type={book.type} src={book.cover} priority sizes="304px" />
      </div>

      <div className="flex min-w-0 flex-col gap-8">
        <header className="flex flex-col gap-3">
          <Badge variant="primary" className="self-start">
            {t(`typeName.${book.type}`)}
          </Badge>
          <h1 className="text-[2rem] leading-tight font-extrabold tracking-[-0.03em] text-balance sm:text-[2.5rem]">
            {book.title}
          </h1>
          {book.author && <p className="text-muted text-lg">{td("by", { author: book.author })}</p>}
          <ul aria-label={td("facts")} className="text-muted flex flex-wrap gap-x-5 gap-y-1">
            {facts.map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
          </ul>
        </header>

        <div>
          <Link
            href={bookReaderPath(book.id)}
            className={buttonVariants({ size: "lg", className: "w-full sm:w-auto" })}
          >
            <BookOpen className="size-5" aria-hidden />
            {td("start")}
          </Link>
        </div>

        {book.description.trim() && (
          <section aria-labelledby="book-about" className="flex flex-col gap-3">
            <h2 id="book-about" className="text-xl font-bold">
              {td("about")}
            </h2>
            <p className="text-muted max-w-[65ch] leading-relaxed whitespace-pre-line">
              {book.description}
            </p>
          </section>
        )}

        <section aria-labelledby="book-contents" className="flex flex-col gap-3">
          <h2 id="book-contents" className="text-xl font-bold">
            {td("contents")}
          </h2>
          {book.chapters.length === 0 ? (
            <p className="text-muted">{td("noContents")}</p>
          ) : (
            <ol className="divide-border border-border max-w-[65ch] divide-y border-y">
              {book.chapters.map((chapter) => (
                <li key={chapter.id}>
                  <Link
                    href={bookReaderPath(book.id, chapter.start_page)}
                    className="hover:bg-subtle flex min-h-11 items-baseline justify-between gap-4 rounded-md px-1 py-2.5 transition-colors"
                  >
                    <span className="min-w-0 font-medium">{chapter.title}</span>
                    <span className="text-muted shrink-0 text-sm tabular-nums">
                      {td("contentsPage", { page: chapter.start_page })}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}

/** Yuklanish holati: tafsilot sahifasi bilan bir xil joylashuv. */
export function BookDetailSkeleton() {
  return (
    <div
      className="grid items-start gap-8 md:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] md:gap-12 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] lg:gap-16"
      aria-hidden
    >
      <div className="bg-surface-2 rounded-cover mx-auto aspect-[2/3] w-full max-w-[14rem] animate-pulse md:max-w-none" />
      <div className="flex flex-col gap-4">
        <div className="bg-surface-2 h-6 w-24 animate-pulse rounded-full" />
        <div className="bg-surface-2 h-10 w-3/4 animate-pulse rounded-lg" />
        <div className="bg-surface-2 h-5 w-1/3 animate-pulse rounded-lg" />
        <div className="bg-surface-2 mt-4 h-12 w-48 animate-pulse rounded-lg" />
      </div>
    </div>
  );
}
