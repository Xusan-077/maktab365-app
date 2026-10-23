import { useTranslations } from "next-intl";
import { buttonVariants } from "@/components/ui/Button";
import { Link } from "@/lib/i18n/navigation";
import { ROUTES } from "@/lib/utils/routes";

export function FinalCta() {
  const t = useTranslations("home.cta");
  return (
    <section
      aria-labelledby="cta-title"
      className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:py-16"
    >
      <div className="bg-primary-600 flex flex-col items-start gap-5 rounded-2xl px-6 py-10 text-white sm:px-10 sm:py-12">
        <h2
          id="cta-title"
          className="max-w-xl text-2xl font-bold tracking-tight text-balance sm:text-3xl"
        >
          {t("title")}
        </h2>
        <p className="max-w-xl text-base text-white">{t("text")}</p>
        <Link href={ROUTES.textbooks} className={buttonVariants({ variant: "accent", size: "lg" })}>
          {t("button")}
        </Link>
      </div>
    </section>
  );
}
