import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BookDetailSkeleton, BookDetailView } from "@/components/books/BookDetailView";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { getBook } from "@/lib/books/server";
import { routing } from "@/lib/i18n/routing";
import { getAlternates } from "@/lib/i18n/seo";
import { bookPath, ROUTES } from "@/lib/utils/routes";

type Props = PageProps<"/[locale]/kitoblar/[id]">;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Kitoblar bazada: bitta namuna yo'l prerender uchun, haqiqiylari birinchi so'rovda quriladi. */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale, id: "namuna" }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale) || !UUID.test(id)) notFound();
  const book = await getBook(id);
  if (!book) notFound();
  const t = await getTranslations({ locale, namespace: "books.detail" });
  const description =
    book.description.trim().slice(0, 200) ||
    t("metaDescription", { title: book.title, author: book.author || "—" });
  return {
    title: book.title,
    description,
    alternates: getAlternates(locale, bookPath(book.id)),
    openGraph: {
      title: book.title,
      description,
      type: "book",
      ...(book.cover
        ? { images: [{ url: book.cover, width: 600, height: 900, alt: book.title }] }
        : {}),
    },
  };
}

export default function BookPage({ params }: Props) {
  return (
    <div className="max-w-site mx-auto flex w-full flex-col gap-8 px-4 pt-10 pb-20 sm:px-8 sm:pt-12 sm:pb-24">
      <Suspense fallback={<BookDetailSkeleton />}>
        <BookContent params={params} />
      </Suspense>
    </div>
  );
}

async function BookContent({ params }: Pick<Props, "params">) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale) || !UUID.test(id)) notFound();
  setRequestLocale(locale);
  const book = await getBook(id);
  if (!book) notFound();
  const [t, tn] = await Promise.all([
    getTranslations({ locale, namespace: "books" }),
    getTranslations({ locale, namespace: "nav" }),
  ]);

  return (
    <>
      <Breadcrumbs
        items={[
          { label: tn("home"), href: ROUTES.home },
          { label: t("title"), href: ROUTES.books },
          { label: book.title },
        ]}
      />
      <BookDetailView book={book} />
    </>
  );
}
