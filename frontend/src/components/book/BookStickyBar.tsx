"use client";

import { BookOpen } from "lucide-react";
import { useTranslations } from "next-intl";
import { useBookResume } from "@/hooks/useBookResume";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils/cn";
import { readerPath } from "@/lib/utils/routes";

interface BookResumeProps {
  bookId: string;
  grade: number;
  slug: string;
  pageCount: number;
}

const primaryLink =
  "bg-brand hover:bg-brand-hover flex items-center justify-center gap-2 rounded-2xl font-bold text-white transition-colors";

/** Progress qatori va chizig'i (o'qishni boshlagan kitobda): "45-betda to'xtagansiz · 19%". */
function ResumeProgress({ bookId, pageCount }: Pick<BookResumeProps, "bookId" | "pageCount">) {
  const t = useTranslations("pdfBooks.page");
  const { entry, read, fraction, percent } = useBookResume(bookId, pageCount);
  if (!entry || fraction <= 0) return null;
  const label = read ? t("progressDone") : t("progressAt", { page: entry.page });
  return (
    <div className="flex flex-col gap-1.5" data-testid="book-resume-progress">
      <div className="text-muted flex justify-between gap-3 text-sm">
        <span className="truncate">{label}</span>
        <span className="tabular-nums">{percent}%</span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={label}
        className="bg-brand-soft h-1.5 overflow-hidden rounded-full"
      >
        <div className="bg-brand h-full rounded-full" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

/** "Onlayn o'qish" yoki "N-betdan davom ettirish" (saqlangan pozitsiya bo'lsa). */
function ResumeLink({
  bookId,
  grade,
  slug,
  pageCount,
  className,
}: BookResumeProps & { className?: string }) {
  const t = useTranslations("pdfBooks.page");
  const { resumePage } = useBookResume(bookId, pageCount);
  return (
    <Link
      href={readerPath({ grade, slug }, resumePage)}
      data-testid="book-resume-link"
      className={cn(primaryLink, className)}
    >
      <BookOpen className="size-5" aria-hidden />
      {resumePage ? t("resume", { page: resumePage }) : t("read")}
    </Link>
  );
}

/**
 * Mobil (md dan kichik) pastki panel: asosiy tugma va progress. `sticky bottom-0` — sahifa
 * kontenti tugaguncha ekran pastida turadi, footer'ga yetganda u bilan birga chiqib ketadi (footer
 * yopilmaydi). iPhone "home indicator" uchun `safe-area-inset-bottom` qo'shiladi.
 */
export function BookStickyBar(props: BookResumeProps) {
  const t = useTranslations("pdfBooks.page");
  return (
    <div
      role="region"
      aria-label={t("quickActions")}
      data-testid="book-sticky-bar"
      className="border-border bg-surface/95 supports-[backdrop-filter]:bg-surface/85 sticky bottom-0 z-30 flex flex-col gap-2.5 border-t px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur md:hidden print:hidden"
    >
      <ResumeProgress bookId={props.bookId} pageCount={props.pageCount} />
      <ResumeLink {...props} className="h-12 w-full text-base" />
    </div>
  );
}

/** Progress kelguncha (Suspense fallback, serverda): faqat "Onlayn o'qish". */
export function BookStickyBarFallback({ grade, slug }: Pick<BookResumeProps, "grade" | "slug">) {
  const t = useTranslations("pdfBooks.page");
  return (
    <div className="border-border bg-surface sticky bottom-0 z-30 border-t px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:hidden print:hidden">
      <Link href={readerPath({ grade, slug })} className={cn(primaryLink, "h-12 w-full text-base")}>
        <BookOpen className="size-5" aria-hidden />
        {t("read")}
      </Link>
    </div>
  );
}

/** Desktop o'ng ustun kartasi: progress va davom ettirish (mobilda pastki panel bor). */
export function BookResumeCard(props: BookResumeProps) {
  return (
    <div
      data-testid="book-resume-card"
      className="border-border bg-surface flex flex-col gap-4 rounded-[1.125rem] border p-5"
    >
      <ResumeProgress bookId={props.bookId} pageCount={props.pageCount} />
      <ResumeLink {...props} className="h-12 px-5 text-base" />
    </div>
  );
}
