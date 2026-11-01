import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookX } from "lucide-react";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BookReader } from "@/components/books/reader/BookReader";
import { BookReaderSkeleton } from "@/components/books/reader/BookReaderSkeleton";
import { buttonVariants } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { getBook } from "@/lib/books/server";
import { Link } from "@/lib/i18n/navigation";
import { routing } from "@/lib/i18n/routing";
import { ROUTES } from "@/lib/utils/routes";

type Props = PageProps<"/[locale]/kitoblar/[id]/oqish">;

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
  // O'qish oynasi qidiruv indeksiga kirmaydi: indekslanadigan sahifa — kitob sahifasi.
  return { title: book.title, robots: { index: false, follow: true } };
}

/** `params` faqat `<Suspense>` ichida o'qiladi (App Shell bitta kitobga bog'lanmasin). */
export default function BookReaderPage({ params }: Props) {
  return (
    <Suspense fallback={<BookReaderSkeleton />}>
      <ReaderContent params={params} />
    </Suspense>
  );
}

async function ReaderContent({ params }: Pick<Props, "params">) {
  const { locale, id } = await params;
  if (!hasLocale(routing.locales, locale) || !UUID.test(id)) notFound();
  setRequestLocale(locale);
  const book = await getBook(id);
  if (!book) notFound();

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
