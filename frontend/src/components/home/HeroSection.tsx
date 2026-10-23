import type { CSSProperties } from "react";
import { Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { GeneratedCover } from "@/components/pdf/GeneratedCover";
import { buttonVariants } from "@/components/ui/Button";
import { Link, getPathname } from "@/lib/i18n/navigation";
import { ROUTES } from "@/lib/utils/routes";
import { GRADES } from "@/types/catalog";
import { HOW_IT_WORKS_ID } from "./ids";

/** Bezak muqovalar: har biri shu sinf darsliklari katalogiga olib boradi (soxta kitoblar emas). */
const FAN = [
  { grade: 9, subject: "algebra", rotate: -8, x: -78, lift: 10 },
  { grade: 7, subject: "biologiya", rotate: 0, x: 0, lift: 0 },
  { grade: 8, subject: "tarix", rotate: 8, x: 78, lift: 10 },
] as const;

/** Hero: sarlavha, qidiruv, sinf tanlash va yelpig'ichdek yoyilgan muqovalar. LCP — sarlavha matni. */
export function HeroSection() {
  const t = useTranslations("home.hero");
  const tg = useTranslations("pdfBooks.catalog");
  const locale = useLocale();
  const action = getPathname({ href: ROUTES.textbooks, locale });

  return (
    <section aria-labelledby="hero-title" className="hero-bg border-border border-b">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:py-20">
        <div className="flex flex-col items-start gap-6">
          <h1 id="hero-title" className="enter text-display max-w-2xl font-extrabold text-balance">
            {t("title")}
          </h1>
          <p
            style={{ "--i": 1 } as CSSProperties}
            className="enter text-muted max-w-xl text-lg text-pretty"
          >
            {t("subtitle")}
          </p>

          <form
            role="search"
            action={action}
            method="get"
            style={{ "--i": 2 } as CSSProperties}
            className="enter flex w-full max-w-xl gap-2"
          >
            <div className="relative min-w-0 flex-1">
              <Search
                className="text-muted pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2"
                aria-hidden
              />
              <input
                type="search"
                name="q"
                aria-label={t("searchLabel")}
                placeholder={t("searchPlaceholder")}
                className="border-border bg-surface text-foreground placeholder:text-muted hover:border-primary-300 h-12 w-full rounded-xl border pr-3 pl-12 text-base shadow-sm transition-colors"
              />
            </div>
            <button type="submit" className={buttonVariants({ size: "lg", className: "px-5" })}>
              {t("search")}
            </button>
          </form>

          <nav
            aria-label={t("gradesLabel")}
            style={{ "--i": 3 } as CSSProperties}
            className="enter flex flex-col gap-2"
          >
            <p className="text-muted text-sm font-medium">{t("gradesLabel")}</p>
            <ul className="flex flex-wrap gap-2">
              {GRADES.map((grade) => (
                <li key={grade}>
                  <Link
                    href={`${ROUTES.textbooks}?grade=${grade}`}
                    aria-label={tg("gradeLabel", { grade })}
                    className="border-border bg-surface hover:border-primary-400 hover:bg-primary-soft hover:text-primary-soft-foreground inline-flex size-11 items-center justify-center rounded-full border text-sm font-semibold tabular-nums shadow-xs transition-colors active:scale-95"
                  >
                    {grade}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <a
            href={`#${HOW_IT_WORKS_ID}`}
            style={{ "--i": 4 } as CSSProperties}
            className="enter text-link inline-flex min-h-11 items-center text-sm font-medium underline-offset-4 hover:underline"
          >
            {t("how")}
          </a>
        </div>

        <div className="relative mx-auto hidden h-[23rem] w-full max-w-md md:block">
          <ul className="absolute inset-0">
            {FAN.map(({ grade, subject, rotate, x, lift }, index) => (
              <li
                key={subject}
                className="hero-cover absolute top-1/2 left-1/2 w-[42%]"
                style={
                  {
                    "--rot": `${rotate}deg`,
                    "--x": `${x}%`,
                    "--y": `${-lift}%`,
                    "--n": index,
                    zIndex: index === 1 ? 2 : 1,
                  } as CSSProperties
                }
              >
                <Link
                  href={`${ROUTES.textbooks}?grade=${grade}`}
                  aria-label={tg("gradeLabel", { grade })}
                  className="group block rounded-md focus-visible:outline-offset-4"
                >
                  <GeneratedCover
                    grade={grade}
                    subject={subject}
                    subjectTitle={t(`samples.${subject}`)}
                    className="w-full shadow-xl"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
