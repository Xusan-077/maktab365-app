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

  const arrow = (target: number, kind: "previous" | "next") => (
    <Link
      href={hrefFor(target)}
      rel={kind === "previous" ? "prev" : "next"}
      aria-label={t(kind)}
      className={cn(box, outlined)}
    >
      {kind === "previous" ? (
        <ChevronLeft className="size-[1.125rem]" aria-hidden />
      ) : (
        <ChevronRight className="size-[1.125rem]" aria-hidden />
      )}
    </Link>
  );

  return (
    <nav aria-label={t("label")} className={className}>
      {/* <640px: ‹ 5 / 10 › — tugmalar 44px, raqamlar qatori sig'maydi */}
      <div className="flex items-center justify-center gap-2 sm:hidden">
        {page > 1 ? arrow(page - 1, "previous") : <span aria-hidden className="size-11" />}
        <span
          aria-current="page"
          aria-label={t("pageOf", { page, total: pageCount })}
          className="flex h-11 min-w-20 items-center justify-center px-2 text-base font-semibold tabular-nums"
        >
          {page} / {pageCount}
        </span>
        {page < pageCount ? arrow(page + 1, "next") : <span aria-hidden className="size-11" />}
      </div>
      <div className="hidden flex-wrap justify-center gap-1.5 sm:flex">
        {page > 1 && arrow(page - 1, "previous")}
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
        {page < pageCount && arrow(page + 1, "next")}
      </div>
    </nav>
  );
}
