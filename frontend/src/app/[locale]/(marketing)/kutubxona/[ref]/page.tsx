import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BookDetailSkeleton, BookDetailView } from "@/components/books/BookDetailView";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { parseBookRef, SAMPLE_REF } from "@/lib/books/ref";
import { getBook, getBookBySlug } from "@/lib/books/server";
import { routing } from "@/lib/i18n/routing";
import { getAlternates } from "@/lib/i18n/seo";
import { libraryBookPath, ROUTES } from "@/lib/utils/routes";

type Props = PageProps<"/[locale]/kutubxona/[ref]">;

/** Kitoblar bazada: bitta namuna yo'l prerender uchun, haqiqiylari birinchi so'rovda quriladi. */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale, ref: SAMPLE_REF }));
}

async function findBook(ref: string) {
  const parsed = parseBookRef(ref);
  if (!parsed) return null;
  return parsed.kind === "id" ? getBook(parsed.value) : getBookBySlug(parsed.value);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, ref } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const book = await findBook(ref);
  if (!book) notFound();
  const t = await getTranslations({ locale, namespace: "books.detail" });
  const description =
    book.description.trim().slice(0, 200) ||
    t("metaDescription", { title: book.title, author: book.author || "—" });
  return {
    title: book.title,
    description,
    alternates: getAlternates(locale, libraryBookPath(book.slug)),
    openGraph: {
      title: book.title,
      description,
      type: "book",
      ...(book.cover
        ? { images: [{ url: book.cover, width: 400, height: 600, alt: book.title }] }
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
  const { locale, ref } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const book = await findBook(ref);
  if (!book) notFound();
  // Eski `/kutubxona/<uuid>` havolasi: kanonik slug manziliga doimiy yo'naltiriladi.
  if (parseBookRef(ref)?.kind === "id")
    permanentRedirect(`/${locale}${libraryBookPath(book.slug)}`);
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
