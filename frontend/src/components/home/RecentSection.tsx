"use client";

import { useEffect, useState } from "react";
import { BookOpen, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { PdfBookCard } from "@/components/pdf/PdfBookCard";
import { buttonVariants } from "@/components/ui/Button";
import { isBookRead, usePdfProgressMap } from "@/hooks/usePdfProgressMap";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { Link } from "@/lib/i18n/navigation";
import { readerPath } from "@/lib/utils/routes";
import { useRecentBooksStore } from "@/stores/recent-books.store";
import { RECENT_ID } from "./ids";
import { Section } from "./Section";

/**
 * Bosh sahifa: «Davom ettirish» (oxirgi ko'rilgan, hali tugatilmagan kitob) va «Oxirgi ko'rilganlar».
 * Ma'lumot shu brauzerdan (mehmon ham), hech narsa yo'q bo'lsa bo'lim chizilmaydi.
 */
export function RecentSection() {
  const t = useTranslations("home.recent");
  const locale = useLocale() as Locale;
  const items = useRecentBooksStore((state) => state.items);
  const clear = useRecentBooksStore((state) => state.clear);
  const progress = usePdfProgressMap();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void useRecentBooksStore.persist.rehydrate()?.then(() => setReady(true));
  }, []);

  if (!ready || items.length === 0) return null;

  const resume = items.find((book) => {
    const entry = progress[book.id];
    return entry && entry.page > 1 && !isBookRead(entry, book.page_count);
  });
  const resumePage = resume ? progress[resume.id].page : 1;
  const others = items.filter((book) => book.id !== resume?.id).slice(0, 8);

  return (
    <Section id={RECENT_ID} title={t("title")} className="pb-0 lg:pb-0">
      <div className="flex flex-col gap-8">
        {resume && (
          <div
            data-testid="home-resume"
            className="border-border bg-surface flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="text-muted text-sm">{t("resumeLabel")}</p>
              <p className="truncate text-lg font-semibold">{getLocalized(resume.title, locale)}</p>
              <p className="text-muted text-sm tabular-nums">
                {t("resumeAt", { page: resumePage, total: resume.page_count })}
              </p>
            </div>
            <Link href={readerPath(resume, resumePage)} className={buttonVariants({ size: "lg" })}>
              <BookOpen className="size-5" aria-hidden />
              {t("resume")}
            </Link>
          </div>
        )}
        {others.length > 0 && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">{t("recent")}</h3>
              <button
                type="button"
                onClick={clear}
                className="text-muted hover:text-foreground inline-flex min-h-11 items-center gap-1 text-sm underline-offset-4 hover:underline"
              >
                <X className="size-4" aria-hidden />
                {t("clear")}
              </button>
            </div>
            <ul className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-4 sm:gap-x-4 lg:grid-cols-6">
              {others.map((book) => (
                <li key={book.id}>
                  <PdfBookCard
                    book={book}
                    resumePage={progress[book.id]?.page}
                    read={isBookRead(progress[book.id], book.page_count)}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Section>
  );
}
