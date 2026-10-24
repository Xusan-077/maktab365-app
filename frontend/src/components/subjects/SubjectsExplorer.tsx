"use client";

import { useState } from "react";
import { ChevronRight, Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { FilterChip } from "@/components/site/FilterChip";
import { formatGrades } from "@/lib/admin/grades";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { Link } from "@/lib/i18n/navigation";
import type { PdfSubject } from "@/lib/pdf-books/api";
import {
  availableTabs,
  buildSections,
  type SubjectSectionKey,
  type SubjectTab,
} from "@/lib/pdf/subject-groups";
import { groupColor } from "@/lib/subject-colors";
import { cn } from "@/lib/utils/cn";
import { ROUTES } from "@/lib/utils/routes";

/** `/fanlar`: yo'nalish tablari + fan qidiruvi + guruhlangan fan kartalari. Server HTML'da hammasi bor. */
export function SubjectsExplorer({ subjects }: { subjects: PdfSubject[] }) {
  const t = useTranslations("subjectsPage");
  const ts = useTranslations("site");
  const locale = useLocale() as Locale;
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<SubjectTab>("all");

  const sectionTitle = (key: SubjectSectionKey) =>
    key === "other" ? t("other") : ts(`groupName.${key}`);
  const tabs = availableTabs(subjects);
  const sections = buildSections(subjects, query, tab);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <search className="w-full sm:w-[21.25rem]">
          <form
            role="search"
            onSubmit={(event) => event.preventDefault()}
            className="border-input-border bg-surface focus-within:border-brand flex h-12 items-center gap-2 rounded-[0.875rem] border-[1.5px] px-3.5"
          >
            <label htmlFor="subject-q" className="text-muted flex">
              <Search className="size-[1.125rem]" role="img" aria-label={t("searchLabel")} />
            </label>
            <input
              id="subject-q"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("searchPlaceholder")}
              className="text-foreground placeholder:text-placeholder min-w-0 flex-1 bg-transparent text-[0.9375rem] outline-none"
            />
          </form>
        </search>
      </div>

      <div
        role="tablist"
        aria-label={t("tabsLabel")}
        className="border-border flex flex-wrap gap-2 border-b pb-1"
      >
        {tabs.map((key) => (
          <FilterChip key={key} role="tab" selected={tab === key} onClick={() => setTab(key)}>
            {key === "all" ? t("all") : sectionTitle(key)}
          </FilterChip>
        ))}
      </div>

      {sections.length === 0 ? (
        <div className="flex flex-col items-start gap-3" role="status">
          <p className="text-muted text-[1.0625rem]">{t("noResults", { query: query.trim() })}</p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setTab("all");
            }}
            className="text-link min-h-11 text-[0.9375rem] font-semibold hover:underline"
          >
            {t("clear")}
          </button>
        </div>
      ) : (
        sections.map(({ key, subjects: items }) => {
          const color = groupColor(key);
          return (
            <section key={key} aria-labelledby={`subjects-${key}`} className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <span aria-hidden className={cn("size-3 rounded-[0.25rem]", color.solid)} />
                <h2
                  id={`subjects-${key}`}
                  className="text-[1.375rem] font-extrabold tracking-[-0.01em]"
                >
                  {sectionTitle(key)}
                </h2>
                <span className="text-faint text-sm">
                  {ts("subjectCount", { count: items.length })}
                </span>
              </div>
              <ul className="grid gap-3 sm:grid-cols-[repeat(auto-fill,minmax(16.25rem,1fr))]">
                {items.map((subject) => {
                  const name = getLocalized(subject.title, locale);
                  return (
                    <li key={subject.slug}>
                      <Link
                        href={`${ROUTES.textbooks}?subject=${encodeURIComponent(subject.slug)}`}
                        className="border-border bg-surface text-foreground flex items-center gap-3.5 rounded-2xl border p-4 transition-shadow hover:shadow-md"
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "flex size-12 shrink-0 items-center justify-center rounded-[0.875rem] text-lg font-extrabold",
                            color.soft,
                            color.text,
                          )}
                        >
                          {name.charAt(0).toLocaleUpperCase(locale)}
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col gap-1">
                          <span className="text-base leading-snug font-bold">{name}</span>
                          <span className="text-muted text-sm">
                            {ts("gradesRange", { range: formatGrades(subject.grades) })}
                          </span>
                        </span>
                        <ChevronRight aria-hidden className="text-placeholder size-[1.125rem]" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })
      )}
    </>
  );
}
