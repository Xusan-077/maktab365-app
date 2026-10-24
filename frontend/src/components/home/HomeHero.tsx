import { Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { GradeTile } from "@/components/site/GradeTile";
import { getPathname } from "@/lib/i18n/navigation";
import type { PdfBook } from "@/lib/pdf-books/api";
import { ROUTES } from "@/lib/utils/routes";
import { GRADES } from "@/types/catalog";
import { HeroCollage } from "./HeroCollage";

/** Kollaj uchun 3 ta kitob: muqova rasmi borlari birinchi (generativ muqovalar keyin). */
const collageBooks = (books: PdfBook[]) =>
  [...books].sort((a, b) => Number(!!b.cover) - Number(!!a.cover)).slice(0, 3);

/** Hero: nishon, sarlavha (LCP — matn), qidiruv, 1–11 sinf tugmalari va o'ngda muqovalar kollaji. */
export function HomeHero({ books }: { books: PdfBook[] }) {
  const t = useTranslations("home.hero");
  const locale = useLocale();
  const action = getPathname({ href: ROUTES.textbooks, locale });

  return (
    <section aria-labelledby="hero-title" className="bg-hero-bg border-border border-b">
      <div className="max-w-site mx-auto flex flex-wrap items-center gap-12 px-4 py-12 sm:px-8 sm:py-[4.5rem] lg:pb-20">
        <div className="flex min-w-0 flex-[1_1_32.5rem] flex-col gap-6">
          <span className="bg-surface text-brand-text border-border rounded-pill flex h-8 items-center gap-2 self-start border px-3.5 text-sm font-semibold">
            <span aria-hidden className="bg-brand size-2 rounded-full" />
            {t("badge")}
          </span>
          <h1
            id="hero-title"
            className="max-w-[38.75rem] text-[2.25rem] leading-[1.06] font-extrabold tracking-[-0.03em] text-balance sm:text-[3.75rem] sm:leading-[1.04]"
          >
            {t("title")}
          </h1>
          <p className="text-muted max-w-[33.75rem] text-[1.0625rem] leading-relaxed sm:text-[1.1875rem]">
            {t("subtitle")}
          </p>

          <form
            role="search"
            action={action}
            method="get"
            className="border-input-border bg-surface mt-2 flex max-w-[35rem] gap-2 rounded-[1.125rem] border-[1.5px] p-1.5 shadow-md"
          >
            <label htmlFor="hero-q" className="text-muted flex items-center pl-3">
              <Search className="size-5" aria-label={t("searchLabel")} role="img" />
            </label>
            <input
              id="hero-q"
              type="search"
              name="q"
              placeholder={t("searchPlaceholder")}
              className="text-foreground placeholder:text-placeholder h-[3.25rem] min-w-0 flex-1 bg-transparent text-[1.0625rem] outline-none"
            />
            <button
              type="submit"
              className="bg-brand hover:bg-brand-hover h-[3.25rem] rounded-[0.8125rem] px-5 text-base font-bold text-white transition-colors sm:px-6"
            >
              {t("search")}
            </button>
          </form>

          <nav aria-label={t("gradesLabel")} className="flex flex-col gap-2.5">
            <span className="text-muted text-sm font-semibold">{t("gradesLabel")}</span>
            <div className="flex flex-wrap gap-2">
              {GRADES.map((grade) => (
                <GradeTile key={grade} grade={grade} variant="button" />
              ))}
            </div>
          </nav>
        </div>

        <HeroCollage books={collageBooks(books)} />
      </div>
    </section>
  );
}
