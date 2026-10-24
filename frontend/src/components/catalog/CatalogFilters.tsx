"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/navigation";
import {
  catalogHref,
  CATALOG_LANGUAGES,
  type CatalogFilters as Filters,
  type CatalogLanguage,
} from "@/lib/pdf/catalog-filters";
import { SUBJECT_GROUPS, type SubjectGroup } from "@/lib/pdf/grade-groups";
import { cn } from "@/lib/utils/cn";
import { ROUTES } from "@/lib/utils/routes";
import { GRADES } from "@/types/catalog";

export interface CatalogFiltersProps {
  /** Hozirgi (URL'dagi) filtrlar. */
  filters: Filters;
  /** `true` — o'zgarishlar "Natijalarni ko'rsatish" bosilguncha qo'llanmaydi (mobil sheet). */
  deferred?: boolean;
  /** Filtr qo'llangandan keyin (sheet'ni yopish uchun). */
  onApplied?: () => void;
  className?: string;
}

const SEARCH_DEBOUNCE_MS = 400;

const legend = "mb-3 text-[0.9375rem] font-bold";
const optionRow = "flex min-h-11 cursor-pointer items-center gap-2.5 text-[0.9375rem]";
const inputAccent = "accent-brand size-[1.125rem]";

/** Filtr paneli: qidiruv, sinf, yo'nalish (ko'p tanlov), til. Natija URL'ga yoziladi, server qayta chizadi. */
export function CatalogFilters({
  filters,
  deferred = false,
  onApplied,
  className,
}: CatalogFiltersProps) {
  const t = useTranslations("catalogPage");
  const ts = useTranslations("site");
  const router = useRouter();
  const languageName = useId();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<Filters>(filters);
  const [query, setQuery] = useState(filters.q ?? "");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // URL o'zgarsa (chip, "orqaga") panel `key` bilan qayta quriladi (`catalogFiltersKey`).
  useEffect(() => () => clearTimeout(timer.current), []);

  const push = (next: Filters) => {
    startTransition(() => {
      router.push(catalogHref(ROUTES.textbooks, next), { scroll: false });
    });
    onApplied?.();
  };
  const update = (patch: Partial<Filters>, immediate = !deferred) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    if (immediate) push(next);
  };
  const submitQuery = (value: string, immediate = !deferred) => {
    const q = value.trim() || undefined;
    if (q === draft.q) return;
    update({ q }, immediate);
  };

  const toggleGroup = (group: SubjectGroup) =>
    update({
      groups: draft.groups.includes(group)
        ? draft.groups.filter((value) => value !== group)
        : [...draft.groups, group],
    });

  return (
    <div
      className={cn("flex flex-col gap-7", pending && "opacity-70 transition-opacity", className)}
    >
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          clearTimeout(timer.current);
          submitQuery(query, !deferred);
        }}
        className="border-input-border bg-surface focus-within:border-brand flex h-12 items-center gap-2 rounded-[0.875rem] border-[1.5px] px-3.5"
      >
        <label htmlFor="catalog-q" className="text-muted flex">
          <Search className="size-[1.125rem]" role="img" aria-label={t("searchLabel")} />
        </label>
        <input
          id="catalog-q"
          type="search"
          value={query}
          onChange={(event) => {
            const value = event.target.value;
            setQuery(value);
            clearTimeout(timer.current);
            if (!deferred) {
              timer.current = setTimeout(() => submitQuery(value), SEARCH_DEBOUNCE_MS);
            }
          }}
          onBlur={() => deferred && submitQuery(query, false)}
          placeholder={t("searchPlaceholder")}
          className="text-foreground placeholder:text-placeholder min-w-0 flex-1 bg-transparent text-[0.9375rem] outline-none"
        />
      </form>

      <fieldset className="flex flex-col">
        <legend className={legend}>{t("grade")}</legend>
        <div className="grid grid-cols-6 gap-1.5">
          <GradeButton
            label={t("allGrades")}
            pressed={!draft.grade}
            onClick={() => update({ grade: undefined })}
            className="col-span-6"
          />
          {GRADES.map((grade) => (
            <GradeButton
              key={grade}
              label={String(grade)}
              ariaLabel={ts("gradeLabel", { grade })}
              pressed={draft.grade === grade}
              onClick={() => update({ grade })}
            />
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col">
        <legend className={legend}>{t("group")}</legend>
        {SUBJECT_GROUPS.map((group) => (
          <label key={group} className={optionRow}>
            <input
              type="checkbox"
              checked={draft.groups.includes(group)}
              onChange={() => toggleGroup(group)}
              className={inputAccent}
            />
            {ts(`groupName.${group}`)}
          </label>
        ))}
      </fieldset>

      <fieldset className="flex flex-col">
        <legend className={legend}>{t("language")}</legend>
        <LanguageOption
          name={languageName}
          label={t("allLanguages")}
          checked={!draft.language}
          onSelect={() => update({ language: undefined })}
        />
        {CATALOG_LANGUAGES.map((language) => (
          <LanguageOption
            key={language}
            name={languageName}
            label={ts(`language.${language}`)}
            checked={draft.language === language}
            onSelect={() => update({ language: language as CatalogLanguage })}
          />
        ))}
      </fieldset>

      {deferred && (
        <button
          type="button"
          onClick={() => {
            clearTimeout(timer.current);
            const q = query.trim() || undefined;
            push({ ...draft, q, page: 1 });
          }}
          className="bg-brand hover:bg-brand-hover h-12 rounded-xl text-base font-bold text-white transition-colors"
        >
          {t("show")}
        </button>
      )}
    </div>
  );
}

function GradeButton({
  label,
  ariaLabel,
  pressed,
  onClick,
  className,
}: {
  label: string;
  ariaLabel?: string;
  pressed: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={ariaLabel}
      onClick={onClick}
      className={cn(
        "h-11 rounded-[0.625rem] border text-[0.9375rem] font-semibold transition-colors",
        pressed
          ? "border-navy bg-navy text-background"
          : "border-input-border bg-surface text-foreground hover:bg-surface-2",
        className,
      )}
    >
      {label}
    </button>
  );
}

function LanguageOption({
  name,
  label,
  checked,
  onSelect,
}: {
  name: string;
  label: string;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <label className={optionRow}>
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onSelect}
        className={inputAccent}
      />
      {label}
    </label>
  );
}
