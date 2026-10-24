import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils/cn";
import { pageWindow } from "./page-window";

export interface PaginationProps {
  page: number;
  pageCount: number;
  /** Sahifa raqami → havola (URL searchParams: indekslanadigan, JS'siz ishlaydi). */
  hrefFor: (page: number) => string;
  className?: string;
}

const box = "flex size-11 items-center justify-center rounded-xl text-base font-semibold";
const outlined = "border-input-border text-foreground hover:bg-surface-2 border";

export function Pagination({ page, pageCount, hrefFor, className }: PaginationProps) {
  const t = useTranslations("site.pagination");
  const items = pageWindow(page, pageCount);
  if (items.length === 0) return null;

  return (
    <nav aria-label={t("label")} className={cn("flex flex-wrap justify-center gap-1.5", className)}>
      {page > 1 && (
        <Link
          href={hrefFor(page - 1)}
          rel="prev"
          aria-label={t("previous")}
          className={cn(box, outlined)}
        >
          <ChevronLeft className="size-[1.125rem]" aria-hidden />
        </Link>
      )}
      {items.map((item, index) =>
        item === "gap" ? (
          <span key={`gap-${index}`} aria-hidden className={cn(box, "text-faint")}>
            …
          </span>
        ) : item === page ? (
          <span
            key={item}
            aria-current="page"
            aria-label={t("page", { page: item })}
            className={cn(box, "bg-navy text-background")}
          >
            {item}
          </span>
        ) : (
          <Link
            key={item}
            href={hrefFor(item)}
            aria-label={t("page", { page: item })}
            className={cn(box, outlined)}
          >
            {item}
          </Link>
        ),
      )}
      {page < pageCount && (
        <Link
          href={hrefFor(page + 1)}
          rel="next"
          aria-label={t("next")}
          className={cn(box, outlined)}
        >
          <ChevronRight className="size-[1.125rem]" aria-hidden />
        </Link>
      )}
    </nav>
  );
}
