import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { EntriesView } from "@/components/books/entries/EntriesView";
import { EntriesSkeleton } from "@/components/books/entries/EntriesStates";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { routing } from "@/lib/i18n/routing";
import { getAlternates } from "@/lib/i18n/seo";
import { ROUTES } from "@/lib/utils/routes";

type Props = PageProps<"/[locale]/kitoblar/yozuvlarim">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "books.entries" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: getAlternates(locale, ROUTES.myEntries),
    // Shaxsiy sahifa: qidiruv tizimlariga kerak emas.
    robots: { index: false, follow: false },
  };
}

const SHELL =
  "max-w-site mx-auto flex w-full flex-col gap-8 px-4 pt-10 pb-20 sm:px-8 sm:pt-12 sm:pb-24";

export default function MyEntriesPage({ params }: Props) {
  return (
    <Suspense
      fallback={
        <div className={SHELL}>
          <EntriesSkeleton />
        </div>
      }
    >
      <MyEntriesContent params={params} />
    </Suspense>
  );
}

async function MyEntriesContent({ params }: Pick<Props, "params">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "books.entries" });
  const tb = await getTranslations({ locale, namespace: "books" });
  const tn = await getTranslations({ locale, namespace: "nav" });

  return (
    <div className={SHELL}>
      <div className="flex flex-col gap-2.5">
        <Breadcrumbs
          items={[
            { label: tn("home"), href: ROUTES.home },
            { label: tb("title"), href: ROUTES.books },
            { label: t("title") },
          ]}
        />
        <h1 className="text-[2rem] font-extrabold tracking-[-0.03em] sm:text-[2.75rem]">
          {t("title")}
        </h1>
        <p className="text-muted max-w-prose text-base">{t("lead")}</p>
      </div>
      <EntriesView />
    </div>
  );
}
