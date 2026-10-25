import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { PageSkeleton } from "@/components/layout/PageSkeleton";
import { PresentationViewer } from "@/components/topic/PresentationViewer";
import { getLocalized } from "@/lib/i18n/localized";
import { routing } from "@/lib/i18n/routing";
import { parseGradeParam } from "@/lib/pdf/grade-groups";
import { flattenToc } from "@/lib/pdf/toc";
import { getBookBySlug } from "@/lib/pdf-books/server";
import { presentationPath, readerPath } from "@/lib/utils/routes";

type Props = PageProps<"/[locale]/darsliklar/[sinf]/[slug]/taqdimot/[mavzu]">;

/** Kitob va mavzular bazada: bitta namuna yo'l oldindan quriladi (prerender uchun), qolgani so'rovda. */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({
    locale,
    sinf: "9",
    slug: "namuna",
    mavzu: "00000000-0000-4000-8000-000000000000",
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug, mavzu } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const [t, book] = await Promise.all([
    getTranslations({ locale, namespace: "presentation" }),
    getBookBySlug(slug),
  ]);
  const topic = book && flattenToc(book.chapters ?? []).find((item) => item.id === mavzu);
  // Taqdimot alohida indekslanmaydi: indekslanadigan sahifa — kitob sahifasi.
  return {
    title:
      book && topic
        ? t("metaTitle", { topic: topic.title, book: getLocalized(book.title, locale) })
        : t("title"),
    robots: { index: false, follow: true },
  };
}

/** `params` faqat `<Suspense>` ichida o'qiladi (o'qish oynasi kabi). */
export default function PresentationPage({ params }: Props) {
  return (
    <Suspense fallback={<PageSkeleton variant="reading" />}>
      <PresentationContent params={params} />
    </Suspense>
  );
}

async function PresentationContent({ params }: Pick<Props, "params">) {
  const { locale, sinf, slug, mavzu } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const grade = parseGradeParam(sinf);
  if (grade === null) notFound();
  setRequestLocale(locale);

  const book = await getBookBySlug(slug);
  if (!book) notFound();
  if (book.grade !== grade) permanentRedirect(`/${locale}${presentationPath(book, mavzu)}`);
  const topic = flattenToc(book.chapters ?? []).find((item) => item.id === mavzu);
  if (!topic) notFound();

  return (
    <PresentationViewer
      topicId={topic.id}
      topicTitle={topic.title}
      bookTitle={getLocalized(book.title, locale)}
      backHref={readerPath(book, topic.page)}
    />
  );
}
