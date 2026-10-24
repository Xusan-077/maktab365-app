"use client";

import { Play } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { BookCover } from "@/components/site/BookCover";
import { readPercent } from "@/components/site/page-window";
import { m } from "@/components/ui/motion";
import { useContinueBooks, type ContinueBook } from "@/hooks/useContinueBooks";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import type { PdfBook } from "@/lib/pdf-books/api";

/** Qatlam joylashuvi (dizayn): chap, markaz, o'ng; har biri o'z burchagi va suzish fazasida. */
const LAYERS = [
  { className: "top-[7.5rem] left-[4%] w-[10.5rem]", rotate: -10, delay: 0 },
  { className: "top-12 left-[26%] w-[11.25rem]", rotate: -3, delay: 1.2 },
  { className: "top-5 left-[48%] w-[13rem]", rotate: 5, delay: 2.4 },
] as const;

/** Sekin tebranish: faqat transform (`MotionConfig reducedMotion="user"` uni o'chiradi). */
const float = (delay: number) => ({
  animate: { y: [0, -8, 0] },
  transition: { duration: 7, ease: "easeInOut" as const, repeat: Infinity, delay },
});

/** Hero o'ng tomoni: so'nggi darsliklar muqovalari va (bo'lsa) "Davom ettirish" kartasi. Faqat bezak. */
export function HeroCollage({ books }: { books: PdfBook[] }) {
  const locale = useLocale() as Locale;
  const { ready, items } = useContinueBooks(1);
  const resume = ready ? items[0] : undefined;

  if (books.length === 0) return null;

  return (
    <div
      aria-hidden
      data-testid="hero-collage"
      className="relative hidden h-[27.5rem] min-w-0 flex-[1_1_26rem] md:block"
    >
      {books.map((book, index) => {
        const layer = LAYERS[index];
        return (
          <m.div
            key={book.id}
            {...float(layer.delay)}
            style={{ rotate: layer.rotate }}
            className={`absolute ${layer.className}`}
          >
            <BookCover
              grade={book.grade}
              title={getLocalized(book.subject_title, locale)}
              group={book.subject_group}
              src={book.cover}
              srcSmall={book.cover_small}
              priority={index === 2}
              sizes="208px"
            />
          </m.div>
        );
      })}
      {resume && <CollageResume item={resume} locale={locale} />}
    </div>
  );
}

function CollageResume({ item, locale }: { item: ContinueBook; locale: Locale }) {
  const t = useTranslations("home.continue");
  const tp = useTranslations("site");
  const { book, page } = item;
  return (
    <m.div
      {...float(1.8)}
      className="bg-surface border-border absolute top-[18.75rem] left-[30%] flex w-[16.25rem] flex-col gap-2 rounded-2xl border px-4 py-3.5 shadow-lg"
    >
      <span className="text-muted flex items-center gap-1.5 text-[0.8125rem]">
        <Play className="size-3" fill="currentColor" />
        {t("cardLabel")}
      </span>
      <span className="text-base font-bold">
        {getLocalized(book.subject_title, locale)} · {tp("stoppedAt", { grade: book.grade, page })}
      </span>
      <span className="bg-brand-soft block h-1.5 overflow-hidden rounded-[3px]">
        <span
          className="bg-brand block h-full rounded-[3px]"
          style={{ width: `${readPercent(page, book.page_count)}%` }}
        />
      </span>
    </m.div>
  );
}
