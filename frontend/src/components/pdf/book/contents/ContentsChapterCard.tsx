"use client";

import { useId } from "react";
import { useReducedMotion } from "framer-motion";
import { Check, ChevronDown, ClipboardCheck, Pencil, Target, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/Skeleton";
import { EASE_OUT, m } from "@/components/ui/motion";
import { Link } from "@/lib/i18n/navigation";
import type {
  ChapterState,
  ContentsChapter,
  ContentsParagraph,
  ContentsPractice,
  ParagraphStatus,
  PracticeKind,
} from "@/lib/pdf/book-contents";
import { cn } from "@/lib/utils/cn";
import { readerPagePath, type BookRef } from "@/lib/utils/routes";
import { Highlight } from "./Highlight";

const PRACTICE_ICONS: Record<PracticeKind, LucideIcon> = {
  exercise: Pencil,
  test: ClipboardCheck,
  project: Target,
};

const PANEL_VARIANTS = {
  open: { height: "auto", opacity: 1, visibility: "visible" },
  closed: { height: 0, opacity: 0, transitionEnd: { visibility: "hidden" } },
};

/** Bet raqami: mobilda qisqa ("77"), kengroq ekranda "77-bet". */
export function PageNumber({ page }: { page: number }) {
  const t = useTranslations("pdfBooks.contents");
  return (
    <span className="text-ds-muted shrink-0 text-sm font-semibold tabular-nums">
      <span className="sm:hidden">{page}</span>
      <span className="hidden sm:inline">{t("page", { page })}</span>
    </span>
  );
}

function ChapterBadge({ roman, state }: { roman: string; state: ChapterState | null }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-[46px] shrink-0 place-items-center rounded-2xl text-[15px] font-extrabold",
        state === "done" && "bg-ds-ok text-ds-on-ok",
        state === "inProgress" && "bg-ds-accent text-ds-on-accent",
        (state === "unread" || state === null) && "bg-ds-canvas text-ds-muted",
      )}
    >
      {state === "done" ? <Check className="size-5" strokeWidth={3} /> : roman}
    </span>
  );
}

function ChapterStatus({ state, percent }: { state: ChapterState | null; percent: number }) {
  const t = useTranslations("pdfBooks.contents");
  if (state === null) return <Skeleton className="h-5 w-32" />;
  if (state === "unread") {
    return <span className="text-ds-muted text-sm font-semibold">{t("chapterUnread")}</span>;
  }
  const done = state === "done";
  return (
    <span className="flex items-center gap-2.5">
      <span
        className={cn(
          "text-sm font-bold tabular-nums",
          done ? "text-ds-ok-ink" : "text-ds-accent-ink",
        )}
      >
        {done ? t("chapterDone") : t("chapterPercent", { percent })}
      </span>
      <span
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={t("chapterProgress", { percent })}
        className="bg-ds-line h-1.5 w-24 overflow-hidden rounded-full"
      >
        <span
          className={cn("block h-full rounded-full", done ? "bg-ds-ok" : "bg-ds-accent")}
          style={{ width: `${percent}%` }}
        />
      </span>
    </span>
  );
}

function ParagraphMarker({ status }: { status: ParagraphStatus }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative z-10 grid size-[22px] shrink-0 place-items-center rounded-full",
        status === "done" && "bg-ds-accent text-ds-on-accent",
        status === "current" && "border-ds-accent bg-ds-surface border-[6px]",
        status === "pending" && "border-ds-line-2 bg-ds-surface border-2",
      )}
    >
      {status === "done" && <Check className="size-3.5" strokeWidth={3.5} />}
    </span>
  );
}

function ParagraphRow({
  paragraph,
  status,
  book,
  lastPage,
  query,
}: {
  paragraph: ContentsParagraph;
  status: ParagraphStatus;
  book: BookRef;
  lastPage: number | null;
  query: string;
}) {
  const t = useTranslations("pdfBooks.contents");
  const current = status === "current";
  return (
    <li
      data-testid="contents-paragraph"
      data-status={status}
      className={cn(
        "rounded-2xl border border-transparent",
        current &&
          "border-ds-accent-line bg-ds-accent-wash flex flex-col gap-2 pr-2 pb-2 sm:flex-row sm:items-center sm:pb-0",
      )}
    >
      <Link
        href={readerPagePath(book, paragraph.page)}
        aria-current={current ? "step" : undefined}
        className={cn(
          "flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-2xl py-2.5 pr-3 pl-2 transition-colors",
          current ? "min-h-16" : "hover:bg-ds-canvas",
        )}
      >
        <ParagraphMarker status={status} />
        <span className="min-w-0 flex-1">
          <span className="text-ds-ink line-clamp-3 text-[15px] leading-snug font-semibold sm:line-clamp-2">
            {paragraph.label && (
              <span className="text-ds-muted font-bold">
                <Highlight text={paragraph.label} query={query} />{" "}
              </span>
            )}
            <Highlight text={paragraph.name} query={query} />
          </span>
          {current && (
            <span className="text-ds-accent-ink mt-0.5 block text-xs font-bold">
              {t("lastRead")}
            </span>
          )}
          <span className="sr-only">, {t(`status.${status}`)}</span>
        </span>
        <PageNumber page={paragraph.page} />
      </Link>
      {current && lastPage !== null && (
        <Link
          href={readerPagePath(book, lastPage)}
          aria-label={t("resumeLabel", { page: lastPage })}
          data-testid="contents-paragraph-resume"
          className="bg-ds-accent text-ds-on-accent hover:bg-ds-accent-ink mx-2 inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl px-4 text-sm font-bold transition-colors sm:mx-0"
        >
          {t("resume")}
        </Link>
      )}
    </li>
  );
}

export interface ContentsChapterCardProps {
  chapter: ContentsChapter;
  paragraphs: readonly ContentsParagraph[];
  practice: readonly ContentsPractice[];
  open: boolean;
  /** Foydalanuvchi bosgandan keyingina animatsiya (birinchi ochilish — darhol). */
  animate: boolean;
  onToggle: () => void;
  /** `null` — o'qish holati hali noma'lum (skelet). */
  state: ChapterState | null;
  percent: number;
  statuses: ReadonlyMap<string, ParagraphStatus>;
  lastPage: number | null;
  book: BookRef;
  query: string;
}

/**
 * Bob kartasi: sarlavha tugmasi (badge, oraliq, nom, holat, chevron) va ochiladigan qism —
 * vertikal chiziqli paragraflar va "Bob oxirida" mashq/testlari. Yopiq qism DOM'da qoladi
 * (`inert`, animatsiya oxirida `visibility: hidden`), balandlik Framer Motion bilan animatsiya qilinadi
 * (`hidden`/`display: none` emas — ular bilan "auto" balandlik animatsiyasi sakraydi).
 */
export function ContentsChapterCard({
  chapter,
  paragraphs,
  practice,
  open,
  animate,
  onToggle,
  state,
  percent,
  statuses,
  lastPage,
  book,
  query,
}: ContentsChapterCardProps) {
  const t = useTranslations("pdfBooks.contents");
  const id = useId();
  const headerId = `${id}-header`;
  const panelId = `${id}-panel`;
  const endId = `${id}-end`;
  const reduceMotion = useReducedMotion();
  const empty = paragraphs.length === 0 && practice.length === 0;

  return (
    <div
      data-testid="contents-chapter"
      data-state={open ? "open" : "closed"}
      className={cn(
        "bg-ds-surface rounded-[24px] border transition-[border-color,box-shadow] duration-200",
        open ? "border-ds-accent-line shadow-md" : "border-ds-line",
      )}
    >
      <h3>
        <button
          type="button"
          id={headerId}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex min-h-11 w-full items-center gap-3 rounded-[24px] p-4 text-left sm:gap-4 sm:p-5"
        >
          <ChapterBadge roman={chapter.roman} state={state} />
          <span className="min-w-0 flex-1">
            <span className="text-ds-muted block text-xs font-extrabold tracking-[0.08em] uppercase">
              {t("chapterRange", {
                roman: chapter.roman,
                start: chapter.startPage,
                end: chapter.endPage,
              })}
            </span>
            <span className="text-ds-ink mt-0.5 block text-[17px] leading-snug font-extrabold">
              <Highlight text={chapter.name} query={query} />
            </span>
            <span className="mt-2 flex sm:hidden">
              <ChapterStatus state={state} percent={percent} />
            </span>
          </span>
          <span className="hidden shrink-0 sm:flex">
            <ChapterStatus state={state} percent={percent} />
          </span>
          <ChevronDown
            aria-hidden
            className={cn(
              "text-ds-muted size-5 shrink-0 transition-transform duration-200 motion-reduce:transition-none",
              open && "rotate-180",
            )}
          />
        </button>
      </h3>
      <m.div
        id={panelId}
        role="region"
        aria-labelledby={headerId}
        inert={!open}
        initial={false}
        animate={open ? "open" : "closed"}
        variants={PANEL_VARIANTS}
        transition={reduceMotion || !animate ? { duration: 0 } : { duration: 0.28, ease: EASE_OUT }}
        className="overflow-hidden"
      >
        <div className="flex flex-col gap-3 px-3 pb-4 sm:px-5 sm:pb-5">
          {empty && (
            <Link
              href={readerPagePath(book, chapter.startPage)}
              className="hover:bg-ds-canvas text-ds-ink flex min-h-11 items-center gap-3 rounded-2xl px-3 py-2.5 font-semibold"
            >
              <span className="min-w-0 flex-1">{chapter.name}</span>
              <PageNumber page={chapter.startPage} />
            </Link>
          )}
          {paragraphs.length > 0 && (
            <ol className="before:bg-ds-line relative flex flex-col gap-1 before:absolute before:top-5 before:bottom-5 before:left-[19px] before:w-0.5">
              {paragraphs.map((paragraph) => (
                <ParagraphRow
                  key={paragraph.id}
                  paragraph={paragraph}
                  status={statuses.get(paragraph.id) ?? "pending"}
                  book={book}
                  lastPage={lastPage}
                  query={query}
                />
              ))}
            </ol>
          )}
          {practice.length > 0 && (
            <div className={cn(paragraphs.length > 0 && "border-ds-line border-t pt-3")}>
              <p
                id={endId}
                className="text-ds-muted px-2 pb-1 text-xs font-extrabold tracking-[0.08em] uppercase"
              >
                {t("chapterEnd")}
              </p>
              <ul aria-labelledby={endId} className="flex flex-col">
                {practice.map((item) => {
                  const Icon = PRACTICE_ICONS[item.kind];
                  return (
                    <li key={item.id} data-testid="contents-practice">
                      <Link
                        href={readerPagePath(book, item.page)}
                        className="hover:bg-ds-canvas flex min-h-11 items-center gap-3 rounded-2xl py-2 pr-3 pl-2 transition-colors"
                      >
                        <span
                          aria-hidden
                          className="bg-ds-accent-tint text-ds-accent-ink grid size-[22px] shrink-0 place-items-center rounded-md"
                        >
                          <Icon className="size-3.5" />
                        </span>
                        <span className="text-ds-ink-2 min-w-0 flex-1 text-[14.5px] leading-snug font-semibold">
                          <span className="sr-only">{t(`practice.${item.kind}`)}: </span>
                          <Highlight text={item.title} query={query} />
                        </span>
                        <PageNumber page={item.page} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </m.div>
    </div>
  );
}
