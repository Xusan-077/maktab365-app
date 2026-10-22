import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { buttonVariants } from "@/components/ui/Button";
import { Link } from "@/lib/i18n/navigation";
import { ROUTES } from "@/lib/utils/routes";
import { HOW_IT_WORKS_ID } from "./ids";

/** Yengil hero: rasm yo'q, LCP — sarlavha matni. */
export function HeroSection() {
  const t = useTranslations("home.hero");
  return (
    <section
      aria-labelledby="hero-title"
      className="from-primary-soft to-background bg-linear-to-b"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-6 px-4 py-12 sm:px-6 lg:py-20">
        <h1
          id="hero-title"
          className="enter max-w-3xl text-4xl font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl"
        >
          {t("title")}
        </h1>
        <p
          style={{ "--i": 1 } as CSSProperties}
          className="enter text-muted max-w-2xl text-lg text-pretty"
        >
          {t("subtitle")}
        </p>
        <div style={{ "--i": 2 } as CSSProperties} className="enter flex flex-wrap gap-3">
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
    </section>
  );
}
