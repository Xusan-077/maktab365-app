import type { CSSProperties } from "react";
import { BookOpen, Calculator, FlaskConical, GraduationCap, Sparkles } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { getPathname } from "@/lib/i18n/navigation";
import { ROUTES } from "@/lib/utils/routes";
import { HeroFan } from "./HeroFan";
import { HeroGrades } from "./HeroGrades";
import { HeroSearch } from "./HeroSearch";
import { HeroStage } from "./HeroStage";
import { HOW_IT_WORKS_ID } from "./ids";

const EXAMPLE_KEYS = ["a", "b", "c", "d", "e"] as const;

/** Bezak suzuvchi belgilar: chuqurlik (`depth`) parallaks kuchini belgilaydi. */
const ORBS = [
  { Icon: GraduationCap, className: "top-[12%] left-[46%]", depth: 26, delay: 0 },
  { Icon: Calculator, className: "bottom-[14%] left-[40%]", depth: -22, delay: 1.2 },
  { Icon: FlaskConical, className: "top-[18%] right-[4%]", depth: -30, delay: 0.6 },
  { Icon: BookOpen, className: "right-[10%] bottom-[10%]", depth: 34, delay: 1.8 },
  { Icon: Sparkles, className: "top-[52%] left-[3%]", depth: 18, delay: 2.4 },
] as const;

/** Hero: sarlavha, qidiruv, sinf tanlash va yelpig'ichdek yoyilgan muqovalar. LCP — sarlavha matni. */
export function HeroSection() {
  const t = useTranslations("home.hero");
  const words = t("title").split(" ");
  const locale = useLocale();
  const action = getPathname({ href: ROUTES.textbooks, locale });

  return (
    <HeroStage labelledBy="hero-title">
      <div aria-hidden className="hero-glow pointer-events-none absolute inset-0" />
      <div aria-hidden className="pointer-events-none absolute inset-0 hidden lg:block">
        {ORBS.map(({ Icon, className, depth, delay }, index) => (
          <span
            key={index}
            style={{ "--depth": depth, "--delay": `${delay}s` } as CSSProperties}
            className={`hero-layer absolute ${className}`}
          >
            <span className="hero-orb bg-surface/70 text-primary-soft-foreground border-border flex size-11 items-center justify-center rounded-2xl border shadow-md backdrop-blur">
              <Icon className="size-5" />
            </span>
          </span>
        ))}
      </div>
      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:py-20">
        <div className="flex flex-col items-start gap-6">
          <h1 id="hero-title" className="text-display max-w-2xl font-extrabold text-balance">
            {words.map((word, index) => (
              <span key={index}>
                <span
                  style={{ "--w": index } as CSSProperties}
                  className={
                    index === words.length - 1 ? "hero-word hero-word-accent" : "hero-word"
                  }
                >
                  {word}
                </span>
                {index < words.length - 1 ? " " : null}
              </span>
            ))}
          </h1>
          <p
            style={{ "--i": 1 } as CSSProperties}
            className="enter text-muted max-w-xl text-lg text-pretty"
          >
            {t("subtitle")}
          </p>

          <HeroSearch
            action={action}
            label={t("searchLabel")}
            examples={EXAMPLE_KEYS.map((key) => t(`searchExamples.${key}`))}
            submitLabel={t("search")}
          />

          <nav
            aria-label={t("gradesLabel")}
            style={{ "--i": 3 } as CSSProperties}
            className="enter flex flex-col gap-2"
          >
            <p className="text-muted text-sm font-medium">{t("gradesLabel")}</p>
            <HeroGrades />
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
          <HeroFan />
        </div>
      </div>
    </HeroStage>
  );
}
