import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { BookCard } from "@/components/site/BookCard";
import { BookCardSkeleton } from "@/components/site/BookCardSkeleton";
import { Breadcrumbs } from "@/components/site/Breadcrumbs";
import { ContinueReadingCard } from "@/components/site/ContinueReadingCard";
import { ActiveFilterChip, FilterChip } from "@/components/site/FilterChip";
import { GradeTile } from "@/components/site/GradeTile";
import { GroupCard } from "@/components/site/GroupCard";
import { Pagination } from "@/components/site/Pagination";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SubjectCard } from "@/components/site/SubjectCard";
import { SHOWCASE_BOOKS } from "@/mocks/site-showcase";
import { SUBJECT_GROUPS } from "@/lib/pdf/grade-groups";

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="max-w-site mx-auto flex w-full flex-col gap-4 px-4 py-8 sm:px-8">
      <h2 className="border-border border-b pb-2 text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

/** `/dev/site`: redesign komponentlari bir sahifada (faqat development). */
export function SiteShowcase() {
  const t = useTranslations("site");
  const ts = useTranslations("site.showcase");

  return (
    <div className="bg-background text-foreground min-h-dvh font-sans">
      <SiteHeader />
      <Block title={ts("cards")}>
        <Breadcrumbs items={[{ label: ts("title"), href: "/" }, { label: ts("cards") }]} />
        <div className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-x-5 gap-y-6">
          {SHOWCASE_BOOKS.map((book, index) => (
            <BookCard key={book.id} book={book} language="uz" priority={index < 2} />
          ))}
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(21rem,1fr))] gap-4">
          <ContinueReadingCard book={SHOWCASE_BOOKS[0]} lastPage={45} />
          <ContinueReadingCard book={SHOWCASE_BOOKS[1]} lastPage={112} />
        </div>
        <div className="flex flex-wrap gap-2">
          {[1, 5, 9, 11].map((grade) => (
            <GradeTile key={grade} grade={grade} variant="button" />
          ))}
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(9.375rem,1fr))] gap-3">
          {[1, 4, 5, 9, 11].map((grade) => (
            <GradeTile key={grade} grade={grade} subjectCount={10 + grade} />
          ))}
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(13.75rem,1fr))] gap-4">
          {SUBJECT_GROUPS.map((group, index) => (
            <GroupCard key={group} group={group} subjectCount={4 + index} href="/fanlar" />
          ))}
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(16.25rem,1fr))] gap-3">
          {SHOWCASE_BOOKS.map((book) => (
            <SubjectCard
              key={book.id}
              href="/fanlar"
              name={book.title.uz}
              group={book.subject_group}
              grades={[7, 8, 9, 10, 11]}
            />
          ))}
        </div>
      </Block>
      <Block title={ts("chips")}>
        <div role="tablist" aria-label={t("menu")} className="flex flex-wrap gap-2">
          <FilterChip href="/fanlar" selected>
            {t("groupName.exact")}
          </FilterChip>
          <FilterChip href="/fanlar">{t("groupName.natural")}</FilterChip>
          <FilterChip href="/fanlar">{t("groupName.language")}</FilterChip>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActiveFilterChip label={t("gradeLabel", { grade: 9 })} removeHref="/darsliklar" />
          <ActiveFilterChip label={t("groupName.exact")} removeHref="/darsliklar" />
        </div>
        <Pagination page={5} pageCount={10} hrefFor={(page) => `/darsliklar?page=${page}`} />
        <Pagination page={1} pageCount={3} hrefFor={(page) => `/darsliklar?page=${page}`} />
      </Block>
      <Block title={ts("loading")}>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-x-5 gap-y-6">
          {Array.from({ length: 4 }, (_, index) => (
            <BookCardSkeleton key={index} />
          ))}
        </div>
      </Block>
      <Block title={ts("footerFull")}>{null}</Block>
      <SiteFooter variant="full" />
      <Block title={ts("footerCompact")}>{null}</Block>
      <SiteFooter />
    </div>
  );
}
