import { useTranslations } from "next-intl";
import { buttonVariants } from "@/components/ui/Button";
import { Link } from "@/lib/i18n/navigation";
import { ROUTES } from "@/lib/utils/routes";
import { HOW_IT_WORKS_ID } from "./ids";
import { LiveLessonDemo } from "./LiveLessonDemo";

/** Yengil hero: rasm yo'q, LCP — sarlavha matni. */
export function HeroSection() {
  const t = useTranslations("home.hero");
  return (
    <section
      aria-labelledby="hero-title"
      className="from-primary-soft to-background bg-linear-to-b"
    >
      <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:py-20">
        <div className="flex flex-col items-start gap-6">
          <h1
            id="hero-title"
            className="text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl"
          >
            {t("title")}
          </h1>
          <p className="text-muted max-w-xl text-lg text-pretty">{t("subtitle")}</p>
          <div className="flex flex-wrap gap-3">
            <Link href={ROUTES.textbooks} className={buttonVariants({ size: "lg" })}>
              {t("cta")}
            </Link>
            <a
              href={`#${HOW_IT_WORKS_ID}`}
              className={buttonVariants({ variant: "secondary", size: "lg" })}
            >
              {t("how")}
            </a>
          </div>
        </div>
        <LiveLessonDemo />
      </div>
    </section>
  );
}
