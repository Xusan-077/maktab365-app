import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { BookX } from "lucide-react";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BookReader } from "@/components/books/reader/BookReader";
import { BookReaderSkeleton } from "@/components/books/reader/BookReaderSkeleton";
import { buttonVariants } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { parseBookRef, SAMPLE_REF } from "@/lib/books/ref";
import { getBook, getBookBySlug } from "@/lib/books/server";
import { Link } from "@/lib/i18n/navigation";
import { NOINDEX } from "@/lib/seo/metadata";
import { routing } from "@/lib/i18n/routing";
import { libraryReaderPath, ROUTES } from "@/lib/utils/routes";

type Props = PageProps<"/[locale]/kutubxona/[ref]/oqish">;

async function findBook(ref: string) {
  const parsed = parseBookRef(ref);
  if (!parsed) return null;
  return parsed.kind === "id" ? getBook(parsed.value) : getBookBySlug(parsed.value);
}

/** Kitoblar bazada: bitta namuna yo'l prerender uchun, haqiqiylari birinchi so'rovda quriladi. */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale, ref: SAMPLE_REF }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, ref } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const book = await findBook(ref);
  if (!book) notFound();
  // O'qish oynasi qidiruv indeksiga kirmaydi: indekslanadigan sahifa — kitob sahifasi.
  return { title: book.title, robots: NOINDEX };
}

/** `params` faqat `<Suspense>` ichida o'qiladi (App Shell bitta kitobga bog'lanmasin). */
export default function BookReaderPage({ params, searchParams }: Props) {
  return (
    <Suspense fallback={<BookReaderSkeleton />}>
      <ReaderContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function ReaderContent({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const { locale, ref } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const book = await findBook(ref);
  if (!book) notFound();
  if (parseBookRef(ref)?.kind === "id") {
    // Saqlangan eski havola (`/kitoblar/<id>/oqish?bet=N`): slug manziliga, `?bet` saqlanadi.
    const bet = Number((await searchParams).bet);
    permanentRedirect(`/${locale}${libraryReaderPath(book.slug, Number.isInteger(bet) ? bet : 1)}`);
  }

  if (book.page_count === 0) {
    const t = await getTranslations({ locale, namespace: "books.reader" });
    const td = await getTranslations({ locale, namespace: "books.detail" });
    return (
      <div className="bg-subtle flex h-dvh items-center justify-center p-6">
        <EmptyState
          icon={BookX}
          className="max-w-md"
          action={
            <Link href={ROUTES.books} className={buttonVariants({ variant: "secondary" })}>
              {td("backToList")}
            </Link>
          }
        >
          <span className="text-foreground block font-semibold">{t("emptyTitle")}</span>
          {t("emptyText")}
        </EmptyState>
      </div>
    );
  }

  return <BookReader book={book} />;
}
