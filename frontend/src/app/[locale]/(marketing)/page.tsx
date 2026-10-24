import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { ContinueSection } from "@/components/home/ContinueSection";
import { HomeHero } from "@/components/home/HomeHero";
import { HomeSkeleton } from "@/components/home/HomeSkeleton";
import {
  GradesSection,
  GroupsSection,
  LatestSection,
  TelegramBand,
} from "@/components/home/HomeSections";
import { routing } from "@/lib/i18n/routing";
import { getAlternates } from "@/lib/i18n/seo";
import { countBooksByGrade } from "@/lib/pdf/grade-groups";
import { getAllBooks, getLatestBooks, getSubjects } from "@/lib/pdf-books/server";
import { ROUTES } from "@/lib/utils/routes";

export async function generateMetadata({ params }: PageProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  return { alternates: getAlternates(locale, ROUTES.home) };
}

/** Ro'yxatga 6 ta; hero kollaji muqovasi borlarini birinchi tanlaydi, shuning uchun ko'proq olinadi. */
const LATEST_COUNT = 6;
const POOL_COUNT = 12;

/** Backend javob bermasa sahifa baribir chiziladi: bo'limlar o'z xato/bo'sh holatini ko'rsatadi. */
async function settled<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch {
    return null;
  }
}

/** `params` faqat `<Suspense>` ichidagi `HomeContent` da o'qiladi (App Shell bitta tilga bog'lanmasin). */
export default function HomePage({ params }: PageProps<"/[locale]">) {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomeContent params={params} />
    </Suspense>
  );
}

async function HomeContent({ params }: Pick<PageProps<"/[locale]">, "params">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const [books, subjects, allBooks] = await Promise.all([
    settled(getLatestBooks(POOL_COUNT)),
    settled(getSubjects()),
    settled(getAllBooks()),
  ]);
  const gradeCounts = allBooks ? countBooksByGrade(allBooks) : null;

  return (
    <>
      {/* O'qishni boshlagan foydalanuvchiga birinchi ekranda: hero'dan oldin. Bo'lmasa bo'sh va yashirin. */}
      <div className="max-w-site mx-auto w-full px-4 pt-6 pb-2 empty:hidden sm:px-8 sm:pt-8">
        <ContinueSection />
      </div>
      <HomeHero books={books ?? []} />
      <div className="max-w-site mx-auto flex w-full flex-col gap-16 px-4 pt-12 pb-20 sm:gap-[5.5rem] sm:px-8 sm:pt-[4.5rem] sm:pb-24">
        <GradesSection gradeCounts={gradeCounts} />
        <GroupsSection subjects={subjects} />
        <LatestSection books={books?.slice(0, LATEST_COUNT) ?? null} />
        <TelegramBand />
      </div>
    </>
  );
}
