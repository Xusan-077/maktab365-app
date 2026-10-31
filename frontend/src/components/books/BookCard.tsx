import { useTranslations } from "next-intl";
import type { Book } from "@/lib/books/api";
import { Link } from "@/lib/i18n/navigation";
import { bookPath } from "@/lib/utils/routes";
import { Skeleton } from "@/components/ui/Skeleton";
import { BookCover } from "./BookCover";

export interface BookCardProps {
  book: Book;
  priority?: boolean;
  sizes?: string;
}

/** Katalog kartasi: muqova (2:3), nom, muallif, tur va betlar soni. Butun karta — bitta havola. */
export function BookCard({ book, priority, sizes }: BookCardProps) {
  const t = useTranslations("books");
  const meta = [t(`typeName.${book.type}`), t("pages", { count: book.page_count })].join(" · ");

  return (
    <Link
      href={bookPath(book.id)}
      data-testid="book-card"
      className="group flex flex-col gap-3 rounded-xl focus-visible:outline-offset-4"
    >
      <BookCover
        title={book.title}
        type={book.type}
        src={book.cover}
        priority={priority}
        sizes={sizes}
        className="transition-transform duration-200 motion-safe:group-hover:-translate-y-0.5"
      />
      <span className="flex flex-col gap-0.5">
        <span className="group-hover:text-link line-clamp-2 text-base leading-snug font-bold text-balance transition-colors">
          {book.title}
        </span>
        {book.author && <span className="text-muted line-clamp-1 text-sm">{book.author}</span>}
        <span className="text-faint text-sm">{meta}</span>
      </span>
    </Link>
  );
}

/** `BookCard` o'lchamidagi skeleton (layout sakramaydi). */
export function BookCardSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      <Skeleton className="rounded-cover aspect-[2/3] w-full" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3.5 w-3/5" />
        <Skeleton className="h-3.5 w-2/5" />
      </div>
    </div>
  );
}
