"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { Link, usePathname, useRouter } from "@/lib/i18n/navigation";
import { pdfQueries, SEARCH_MIN_LENGTH } from "@/lib/pdf-books/queries";
import { matchGrades, matchSubjects } from "@/lib/search/palette";
import { cn } from "@/lib/utils/cn";
import { gradePath, pdfBookPath, readerPath, ROUTES } from "@/lib/utils/routes";

const SEARCH_DEBOUNCE_MS = 200;
const MAX_RESULTS = 8;

const isEditable = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/**
 * Panel qidiruvi: topbar'dagi tugma yoki ⌘K / Ctrl+K / "/" bilan ochiladi. Darsliklar nomi
 * bo'yicha qidiriladi, natija o'qish sahifasiga olib boradi.
 */
export function PanelSearch({
  className,
  variant = "field",
}: {
  className?: string;
  /** `field` — kirish maydoni ko'rinishidagi tugma (panel); `icon` — ikonka tugma, keng ekranda "Ctrl K" belgisi bilan (sayt sarlavhasi). */
  variant?: "field" | "icon";
}) {
  const t = useTranslations("panel.search");
  const tErrors = useTranslations("errors");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const q = useDebouncedValue(input.trim(), SEARCH_DEBOUNCE_MS);
  const enabled = q.length >= SEARCH_MIN_LENGTH;

  const books = useQuery({ ...pdfQueries.list({ q }), enabled });
  const chapters = useQuery({ ...pdfQueries.chapterSearch(q), enabled });
  const subjects = useQuery({ ...pdfQueries.subjects(), enabled });
  const grades = matchGrades(input);
  const subjectHits = matchSubjects(subjects.data ?? [], q).slice(0, 4);
  const sectionHits = chapters.data ?? [];

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey) return;
      const palette = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      const slash = event.key === "/" && !event.metaKey && !event.ctrlKey;
      if (!palette && !slash) return;
      if (slash && (isEditable(event.target) || document.querySelector("dialog[open]"))) return;
      event.preventDefault();
      setOpen(true);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Dialog'ning `showModal()` effekti bolalarnikidan keyin ishlaydi, shuning uchun fokus alohida kadrda.
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  // Natijaga o'tilgach (yoki boshqa yo'lga) oyna yopiladi va so'rov tozalanadi.
  const [seenPathname, setSeenPathname] = useState(pathname);
  if (seenPathname !== pathname) {
    setSeenPathname(pathname);
    setOpen(false);
    setInput("");
  }

  const hits = (books.data?.results ?? []).slice(0, MAX_RESULTS);
  const failed = enabled && books.isError;
  const pending = enabled && !failed && books.isPending;
  const firstHref = hits[0] ? pdfBookPath(hits[0]) : undefined;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (firstHref) router.push(firstHref);
  };

  const itemClasses = "hover:bg-subtle flex flex-col gap-0.5 rounded-lg px-3 py-2";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("open")}
        aria-keyshortcuts="Control+K Meta+K /"
        className={cn(
          variant === "icon"
            ? "border-border bg-surface text-foreground hover:bg-surface-2 inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-xl border text-sm transition-colors md:px-3"
            : "border-border bg-surface text-muted hover:border-primary-300 hover:text-foreground inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm shadow-xs transition-colors max-lg:w-10 max-lg:justify-center max-lg:border-transparent max-lg:px-0 max-lg:shadow-none lg:w-72",
          className,
        )}
      >
        <Search className="size-4 shrink-0" aria-hidden />
        {variant === "icon" ? (
          <kbd className="text-faint hidden font-sans text-xs font-medium md:inline">Ctrl K</kbd>
        ) : (
          <>
            <span className="hidden flex-1 text-left lg:inline">{t("placeholder")}</span>
            <kbd className="bg-subtle hidden rounded px-1.5 py-0.5 text-xs lg:inline">⌘K</kbd>
          </>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen} title={t("title")} className="sm:max-w-xl">
        <form role="search" onSubmit={onSubmit} className="relative">
          <Search
            className="text-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden
          />
          <input
            ref={inputRef}
            type="search"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            aria-label={t("label")}
            placeholder={t("placeholder")}
            autoComplete="off"
            className="border-border bg-surface placeholder:text-muted h-11 w-full rounded-lg border pr-3 pl-9 text-base"
          />
        </form>

        <div aria-live="polite" className="flex min-h-24 flex-col gap-4">
          {!enabled && grades.length === 0 && <p className="text-muted text-sm">{t("hint")}</p>}
          {grades.length > 0 && (
            <section aria-label={t("grades")}>
              <h3 className="text-muted px-3 pb-1 text-xs font-semibold uppercase">
                {t("grades")}
              </h3>
              <ul>
                {grades.map((grade) => (
                  <li key={grade}>
                    <Link href={gradePath(grade)} className={itemClasses}>
                      <span className="font-medium">{t("gradeItem", { grade })}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {pending && <Skeleton className="h-24 w-full" />}
          {failed && (
            <div role="alert" className="flex flex-col items-start gap-2">
              <p className="text-danger text-sm">{tErrors("backendDown")}</p>
              <Button size="sm" variant="secondary" onClick={() => void books.refetch()}>
                {tErrors("retry")}
              </Button>
            </div>
          )}
          {enabled &&
            !pending &&
            !failed &&
            hits.length === 0 &&
            grades.length === 0 &&
            subjectHits.length === 0 &&
            sectionHits.length === 0 && (
              <p className="text-muted text-sm">{t("empty", { query: q })}</p>
            )}

          {subjectHits.length > 0 && (
            <section aria-label={t("subjects")}>
              <h3 className="text-muted px-3 pb-1 text-xs font-semibold uppercase">
                {t("subjects")}
              </h3>
              <ul>
                {subjectHits.map((subject) => (
                  <li key={subject.slug}>
                    <Link
                      href={`${ROUTES.textbooks}?subject=${subject.slug}`}
                      className={itemClasses}
                    >
                      <span className="font-medium">{getLocalized(subject.title, locale)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {hits.length > 0 && (
            <section aria-label={t("books")}>
              <h3 className="text-muted px-3 pb-1 text-xs font-semibold uppercase">{t("books")}</h3>
              <ul>
                {hits.map((book) => (
                  <li key={book.id}>
                    <Link href={pdfBookPath(book)} className={itemClasses}>
                      <span className="font-medium">{getLocalized(book.title, locale)}</span>
                      <span className="text-muted text-sm">
                        {t("meta", {
                          grade: book.grade,
                          subject: getLocalized(book.subject_title, locale),
                        })}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {sectionHits.length > 0 && (
            <section aria-label={t("sections")}>
              <h3 className="text-muted px-3 pb-1 text-xs font-semibold uppercase">
                {t("sections")}
              </h3>
              <ul>
                {sectionHits.map((hit) => (
                  <li key={hit.id}>
                    <Link href={readerPath(hit.book, hit.page)} className={itemClasses}>
                      <span className="font-medium">{hit.title}</span>
                      <span className="text-muted text-sm">
                        {t("sectionMeta", {
                          book: getLocalized(hit.book.title, locale),
                          page: hit.page,
                        })}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </Dialog>
    </>
  );
}
