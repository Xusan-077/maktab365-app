import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { SubjectsExplorer } from "@/components/subjects/SubjectsExplorer";
import { SubjectsSkeleton } from "@/components/subjects/SubjectsSkeleton";
import { SectionJsonLd } from "@/components/seo/SectionJsonLd";
import { routing } from "@/lib/i18n/routing";
import { buildMetadata, splitKeywords } from "@/lib/seo/metadata";
import { getSubjects } from "@/lib/pdf-books/server";
import { ROUTES } from "@/lib/utils/routes";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/fanlar">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "subjectsPage" });
  const tm = await getTranslations({ locale, namespace: "meta" });
  return buildMetadata({
    locale,
    path: ROUTES.subjects,
    title: t("metaTitle"),
    description: t("metaDescription"),
    keywords: splitKeywords(tm("keywords")),
  });
}

/**
 * `params` faqat `SubjectsContent` ichida o'qiladi va u `<Suspense>` ichida: aks holda App Shell
 * bitta URL'ga bog'lanib qoladi (Next "URL data outside of Suspense" xatosi, partialPrefetching).
 */
export default function SubjectsPage({ params }: PageProps<"/[locale]/fanlar">) {
  return (
    <Suspense fallback={<SubjectsSkeleton />}>
      <SubjectsContent params={params} />
    </Suspense>
  );
}

async function SubjectsContent({ params }: Pick<PageProps<"/[locale]/fanlar">, "params">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "subjectsPage" });
  const tn = await getTranslations({ locale, namespace: "nav" });

  // Backend javob bermasa sahifa chiziladi, xato holati ko'rsatiladi.
  const subjects = await getSubjects().catch(() => null);

  return (
    <div className="max-w-site mx-auto flex w-full flex-col gap-10 px-4 pt-10 pb-20 sm:px-8 sm:pt-12 sm:pb-24">
      <SectionJsonLd locale={locale} name={t("title")} path={ROUTES.subjects} />
      <div className="flex flex-col gap-2.5">
        <Breadcrumbs items={[{ label: tn("home"), href: ROUTES.home }, { label: t("title") }]} />
        <h1 className="text-[2rem] font-extrabold tracking-[-0.03em] sm:text-[2.75rem]">
          {t("title")}
        </h1>
        <p className="text-muted text-[1.0625rem]">{t("description")}</p>
      </div>
      {subjects === null ? (
        <p role="alert" className="text-muted">
          {t("error")}
        </p>
      ) : subjects.length === 0 ? (
        <p className="text-muted">{t("empty")}</p>
      ) : (
        <SubjectsExplorer subjects={subjects} />
      )}
    </div>
  );
}
