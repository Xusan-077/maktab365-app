import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { pageShellClass } from "@/components/layout/containers";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { getApi } from "@/lib/api";
import { getLocalized } from "@/lib/i18n/localized";
import { Link } from "@/lib/i18n/navigation";
import { routing } from "@/lib/i18n/routing";
import { getAlternates } from "@/lib/i18n/seo";
import { ROUTES, subjectPath } from "@/lib/utils/routes";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/fanlar">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "subjectsPage.meta" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: getAlternates(locale, ROUTES.subjects),
  };
}

export default async function SubjectsPage({ params }: PageProps<"/[locale]/fanlar">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("subjectsPage");
  const tb = await getTranslations("breadcrumb");
  const api = getApi();
  const [subjects, books] = await Promise.all([api.getSubjects(), api.getBooks()]);

  return (
    <div className={`${pageShellClass("marketing")} flex flex-col gap-6`}>
      <Breadcrumbs items={[{ label: tb("home"), href: ROUTES.home }, { label: t("title") }]} />
      <PageHeader title={t("title")} description={t("subtitle")} />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {subjects.map((subject) => (
          <li key={subject.id}>
            <Card interactive className="relative h-full">
              <h2 className="text-base font-semibold">
                <Link
                  href={subjectPath(subject.slug)}
                  className="rounded-md after:absolute after:inset-0 after:rounded-xl"
                >
                  {getLocalized(subject.name, locale)}
                </Link>
              </h2>
              <p className="text-muted mt-1 text-sm">
                {t("booksCount", { count: books.filter((b) => b.subjectId === subject.id).length })}
              </p>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
