import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { AudienceSection } from "@/components/home/AudienceSection";
import { FaqSection } from "@/components/home/FaqSection";
import { FinalCta } from "@/components/home/FinalCta";
import { GradeExplorer, GradeExplorerSkeleton } from "@/components/home/GradeExplorer";
import { HeroSection } from "@/components/home/HeroSection";
import { HowItWorks } from "@/components/home/HowItWorks";
import { TopicAnatomy } from "@/components/home/TopicAnatomy";
import { HydrateQueries } from "@/components/layout/HydrateQueries";
import { apiQueries } from "@/lib/api/queries";
import { routing } from "@/lib/i18n/routing";
import { getAlternates } from "@/lib/i18n/seo";
import { ROUTES } from "@/lib/utils/routes";

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  return { alternates: getAlternates(locale, ROUTES.home) };
}

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  return (
    <>
      <HeroSection />
      {/* useSearchParams (?grade=) uchun Suspense kerak; katalog server'da prefetch qilinadi */}
      <Suspense fallback={<GradeExplorerSkeleton />}>
        <HydrateQueries
          prefetch={(queryClient) =>
            Promise.all([
              queryClient.prefetchQuery(apiQueries.grades()),
              queryClient.prefetchQuery(apiQueries.subjects()),
              queryClient.prefetchQuery(apiQueries.books()),
            ])
          }
        >
          <GradeExplorer />
        </HydrateQueries>
      </Suspense>
      <TopicAnatomy locale={locale} />
      <AudienceSection />
      <HowItWorks />
      <FaqSection />
      <FinalCta />
    </>
  );
}
