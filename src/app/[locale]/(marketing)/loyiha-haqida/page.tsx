import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, useTranslations } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { buttonVariants } from "@/components/ui/Button";
import { Link } from "@/lib/i18n/navigation";
import { routing } from "@/lib/i18n/routing";
import { getAlternates } from "@/lib/i18n/seo";
import { ROUTES } from "@/lib/utils/routes";

const POINT_KEYS = ["free", "topics", "roles", "languages"] as const;

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/loyiha-haqida">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "aboutPage" });
  return {
    title: t("title"),
    description: t("lead"),
    alternates: getAlternates(locale, ROUTES.about),
  };
}

function AboutContent() {
  const t = useTranslations("aboutPage");
  const tb = useTranslations("breadcrumb");
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:px-6">
      <Breadcrumbs items={[{ label: tb("home"), href: ROUTES.home }, { label: t("title") }]} />
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted text-lg">{t("lead")}</p>
      </header>
      <ul className="flex flex-col gap-5">
        {POINT_KEYS.map((key) => (
          <li key={key} className="flex flex-col gap-1">
            <h2 className="text-xl font-semibold">{t(`points.${key}.title`)}</h2>
            <p className="text-muted">{t(`points.${key}.text`)}</p>
          </li>
        ))}
      </ul>
      <div>
        <Link href={ROUTES.textbooks} className={buttonVariants({ size: "lg" })}>
          {t("cta")}
        </Link>
      </div>
    </div>
  );
}

export default async function AboutPage({ params }: PageProps<"/[locale]/loyiha-haqida">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return <AboutContent />;
}
