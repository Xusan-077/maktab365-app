import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { MARKETING_CONTAINER, PAGE_STACK } from "@/components/layout/containers";
import { JsonLd } from "@/components/pdf/JsonLd";
import { BookGrid, GradeBooks } from "@/components/pdf/grade/GradeBooks";
import { AllGrades, GradeStatsBar, HowTo } from "@/components/pdf/grade/GradeParts";
import { routing } from "@/lib/i18n/routing";
import { getAlternates, OG_IMAGES, SITE_URL } from "@/lib/i18n/seo";
import { gradeStats, parseGradeParam } from "@/lib/pdf/grade-groups";
import { getGradeBooks } from "@/lib/pdf-books/server";
import { bookItemList, breadcrumbList } from "@/lib/seo/jsonld";
import { GRADES } from "@/types/catalog";
import { gradePath, ROUTES } from "@/lib/utils/routes";

/** 1–11-sinf sahifalari oldindan quriladi. */
export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    GRADES.map((grade) => ({ locale, sinf: String(grade) })),
  );
}

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/darsliklar/[sinf]">): Promise<Metadata> {
  const { locale, sinf } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const grade = parseGradeParam(sinf);
  if (grade === null) notFound();
  const [t, books] = await Promise.all([
    getTranslations({ locale, namespace: "pdfBooks.grade.meta" }),
    getGradeBooks(grade),
  ]);
  const title = t("title", { grade });
  const description = t("description", { grade, count: books.length });
  return {
    title,
    description,
    alternates: getAlternates(locale, gradePath(grade)),
    openGraph: { title, description, type: "website", images: OG_IMAGES },
  };
}

export default async function GradePage({ params }: PageProps<"/[locale]/darsliklar/[sinf]">) {
  const { locale, sinf } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const grade = parseGradeParam(sinf);
  if (grade === null) notFound();
  setRequestLocale(locale);

  const [t, tn, books] = await Promise.all([
    getTranslations({ locale, namespace: "pdfBooks.grade" }),
    getTranslations({ locale, namespace: "nav" }),
    getGradeBooks(grade),
  ]);
  const title = t("title", { grade });
  const gradeLabel = t("breadcrumb.grade", { grade });

  return (
    <div className={`${MARKETING_CONTAINER} py-8 ${PAGE_STACK}`}>
      <Breadcrumbs
        items={[
          { label: tn("home"), href: ROUTES.home },
          { label: tn("textbooks"), href: ROUTES.textbooks },
          { label: gradeLabel },
        ]}
      />
      <header className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {title}
          </h1>
          <p className="text-muted max-w-prose text-pretty">{t("description", { grade })}</p>
        </div>
        {books.length > 0 && <GradeStatsBar stats={gradeStats(books)} />}
      </header>

      {/* `useSearchParams` (URL filtrlari) Suspense talab qiladi; fallback — qidiruv tizimlari va
          JS yuklanguncha ko'rinadigan tayyor ro'yxat (layout sakramaydi). */}
      <Suspense fallback={<BookGrid books={books} />}>
        <GradeBooks books={books} grade={grade} />
      </Suspense>

      <AllGrades current={grade} />
      <HowTo />

      <JsonLd
        data={breadcrumbList(SITE_URL, locale, [
          { name: tn("home"), path: ROUTES.home },
          { name: tn("textbooks"), path: ROUTES.textbooks },
          { name: gradeLabel, path: gradePath(grade) },
        ])}
      />
      {books.length > 0 && <JsonLd data={bookItemList(SITE_URL, locale, title, books)} />}
    </div>
  );
}
