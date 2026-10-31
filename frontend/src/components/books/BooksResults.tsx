import { BookOpen } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Pagination } from "@/components/site/Pagination";
import { EmptyState } from "@/components/ui/EmptyState";
import { BOOKS_PAGE_SIZE } from "@/lib/books/api";
import {
  activeBookFilterCount,
  booksHref,
  EMPTY_BOOK_FILTERS,
  toBooksApiFilters,
  type BooksUrlFilters,
} from "@/lib/books/filters";
import { getBooksPage } from "@/lib/books/server";
import { Link } from "@/lib/i18n/navigation";
import { ROUTES } from "@/lib/utils/routes";
import { buttonVariants } from "@/components/ui/Button";
import { BookCard, BookCardSkeleton } from "./BookCard";

const GRID =
  "grid grid-cols-2 gap-x-5 gap-y-8 min-[560px]:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";
const SIZES = "(min-width: 1280px) 190px, (min-width: 560px) 30vw, 45vw";

/** Natijalar (server): soni, kitoblar to'ri, sahifalash; bo'sh va xato holatlari. */
export async function BooksResults({ filters }: { filters: BooksUrlFilters }) {
  const t = await getTranslations("books");
  const result = await getBooksPage(toBooksApiFilters(filters)).catch(() => null);

  if (result === null) {
    return (
      <section aria-label={t("results")} className="flex flex-col items-start gap-4 py-6">
        <p role="alert" className="text-muted text-[1.0625rem]">
          {t("errorText")}
        </p>
        <Link
          href={booksHref(ROUTES.books, filters, { page: filters.page })}
          className={buttonVariants({ variant: "secondary" })}
        >
          {t("retry")}
        </Link>
      </section>
    );
  }

  if (result.count === 0) {
    const filtered = filters.type !== undefined || activeBookFilterCount(filters) > 0;
    return (
      <section aria-label={t("results")}>
        <EmptyState
          icon={BookOpen}
          action={
            filtered ? (
              <Link
                href={booksHref(ROUTES.books, EMPTY_BOOK_FILTERS)}
                className={buttonVariants({ variant: "secondary" })}
              >
                {t("reset")}
              </Link>
            ) : undefined
          }
        >
          <span className="text-foreground block font-semibold">{t("emptyTitle")}</span>
          {filtered ? t("emptyText") : t("emptyAll")}
        </EmptyState>
      </section>
    );
  }

  const pageCount = Math.ceil(result.count / BOOKS_PAGE_SIZE);

  return (
    <section aria-label={t("results")} className="flex flex-col gap-6">
      <p className="text-muted text-[0.9375rem]" aria-live="polite">
        {t("count", { count: result.count })}
      </p>
      <ul className={GRID}>
        {result.results.map((book, index) => (
          <li key={book.id}>
            <BookCard book={book} priority={index < 5} sizes={SIZES} />
          </li>
        ))}
      </ul>
      <Pagination
        page={filters.page}
        pageCount={pageCount}
        hrefFor={(page) => booksHref(ROUTES.books, filters, { page })}
        className="pt-2"
      />
    </section>
  );
}

/** Yuklanish holati: karta bilan bir xil o'lcham. */
export function BooksResultsSkeleton() {
  return (
    <div className={GRID} aria-hidden>
      {Array.from({ length: 10 }, (_, index) => (
        <BookCardSkeleton key={index} />
      ))}
    </div>
  );
}
