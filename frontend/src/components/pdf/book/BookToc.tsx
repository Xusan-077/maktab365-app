"use client";

import { ChevronRight, Presentation } from "lucide-react";
import { useTranslations } from "next-intl";
import { TocTree } from "@/components/pdf/TocTree";
import { Badge } from "@/components/ui/Badge";
import { usePdfProgressMap } from "@/hooks/usePdfProgressMap";
import { Link } from "@/lib/i18n/navigation";
import type { PdfBookDetail } from "@/lib/pdf-books/api";
import { cn } from "@/lib/utils/cn";
import { readerPath } from "@/lib/utils/routes";
import { sectionHeading } from "./book-styles";

/**
 * Kitob sahifasidagi mundarija: boblar bo'yicha ochib-yopiladi (o'quvchi to'xtagan bob ochiq),
 * har qator o'qish oynasida shu betga ochadi; prezentatsiyasi borlarga belgi. Tartib raqamlari yo'q
 * — sarlavhaning o'zi ("1-§ …") yetarli.
 */
export function BookToc({ book }: { book: PdfBookDetail }) {
  const t = useTranslations("pdfBooks.page");
  const position = usePdfProgressMap()[book.id];
  const chapters = book.chapters ?? [];
  if (chapters.length === 0) return null;
  return (
    <section aria-labelledby="book-toc" className="flex min-w-0 flex-col gap-4">
      <h2 id="book-toc" className={sectionHeading}>
        {t("toc")}
      </h2>
      <TocTree
        chapters={chapters}
        page={position?.page ?? null}
        testId="book-toc"
        className="[&>ol]:border-border [&>ol]:rounded-[1.125rem] [&>ol]:border [&>ol]:p-1.5"
        renderItem={(item, { active }) => (
          <Link
            href={readerPath(book, item.page)}
            aria-current={active ? "location" : undefined}
            data-testid="book-toc-item"
            className={cn(
              "hover:bg-surface-2 flex min-h-11 items-center gap-4 rounded-xl px-4 py-3 transition-colors",
              item.level === 1 && "pl-10",
              active && "bg-brand-soft",
            )}
          >
            <span
              className={cn(
                "min-w-0 flex-1 text-base",
                item.level === 0 ? "font-semibold" : "text-muted",
              )}
            >
              {item.title}
            </span>
            {item.slides && (
              <Badge variant="accent" className="shrink-0 gap-1">
                <Presentation className="size-3" aria-hidden />
                {t("tocPresentation")}
              </Badge>
            )}
            <span className="text-muted shrink-0 text-sm tabular-nums">
              {t("tocPage", { page: item.page })}
            </span>
            <ChevronRight className="text-faint size-[1.125rem] shrink-0" aria-hidden />
          </Link>
        )}
      />
    </section>
  );
}
