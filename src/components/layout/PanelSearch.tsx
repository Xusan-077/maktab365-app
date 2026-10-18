"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/Badge";
import { Dialog } from "@/components/ui/Dialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAppPaths } from "@/hooks/useAppPaths";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useSearchTopics } from "@/hooks/useSearchTopics";
import { apiQueries, SEARCH_MIN_LENGTH } from "@/lib/api/queries";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { Link, usePathname, useRouter } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils/cn";

const SEARCH_DEBOUNCE_MS = 200;
const MAX_RESULTS = 6;

const isEditable = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));

/**
 * Panel qidiruvi: topbar'dagi tugma yoki ⌘K / Ctrl+K / "/" bilan ochiladi. Natijalar
 * joriy panel ichidagi kitob va mavzu sahifalariga olib boradi (marketing yo'llariga emas).
 */
export function PanelSearch({ className }: { className?: string }) {
  const t = useTranslations("panel.search");
  const locale = useLocale() as Locale;
  const paths = useAppPaths();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const q = useDebouncedValue(input.trim(), SEARCH_DEBOUNCE_MS);
  const enabled = q.length >= SEARCH_MIN_LENGTH;

  const books = useQuery({ ...apiQueries.books({ q }), enabled });
  const topics = useSearchTopics(q);

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

  const bookHits = (books.data ?? []).slice(0, MAX_RESULTS);
  const topicHits = (topics.data ?? []).slice(0, MAX_RESULTS);
  const pending = enabled && (books.isPending || topics.isPending);
  const firstTopic = topicHits.find((hit) => hit.topic.ready);
  const firstHref = bookHits[0]
    ? paths.book(bookHits[0].id)
    : firstTopic
      ? paths.topic(firstTopic.topic.bookId, firstTopic.topic.id)
      : undefined;

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
          "border-border bg-surface text-muted hover:border-primary-300 hover:text-foreground inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm shadow-xs transition-colors max-lg:w-10 max-lg:justify-center max-lg:border-transparent max-lg:px-0 max-lg:shadow-none lg:w-72",
          className,
        )}
      >
        <Search className="size-4 shrink-0" aria-hidden />
        <span className="hidden flex-1 text-left lg:inline">{t("placeholder")}</span>
        <kbd className="bg-subtle hidden rounded px-1.5 py-0.5 text-xs lg:inline">⌘K</kbd>
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
          {!enabled && <p className="text-muted text-sm">{t("hint")}</p>}
          {pending && <Skeleton className="h-24 w-full" />}
          {enabled && !pending && bookHits.length === 0 && topicHits.length === 0 && (
            <p className="text-muted text-sm">{t("empty", { query: q })}</p>
          )}

          {bookHits.length > 0 && (
            <section aria-label={t("books")}>
              <h3 className="text-muted px-3 pb-1 text-xs font-semibold uppercase">{t("books")}</h3>
              <ul>
                {bookHits.map((book) => (
                  <li key={book.id}>
                    <Link href={paths.book(book.id)} className={itemClasses}>
                      <span className="font-medium">{getLocalized(book.title, locale)}</span>
                      <span className="text-muted text-sm">
                        {getLocalized(book.author, locale)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {topicHits.length > 0 && (
            <section aria-label={t("topics")}>
              <h3 className="text-muted px-3 pb-1 text-xs font-semibold uppercase">
                {t("topics")}
              </h3>
              <ul>
                {topicHits.map(({ topic, bookTitle, chapterTitle }) => (
                  <li key={topic.id}>
                    {topic.ready ? (
                      <Link href={paths.topic(topic.bookId, topic.id)} className={itemClasses}>
                        <span className="font-medium">{getLocalized(topic.title, locale)}</span>
                        <span className="text-muted text-sm">
                          {getLocalized(bookTitle, locale)} · {getLocalized(chapterTitle, locale)}
                        </span>
                      </Link>
                    ) : (
                      <span className={cn(itemClasses, "text-muted hover:bg-transparent")}>
                        <span className="flex items-center gap-2">
                          {getLocalized(topic.title, locale)}
                          <Badge variant="accent">{t("soon")}</Badge>
                        </span>
                      </span>
                    )}
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
