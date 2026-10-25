"use client";

import { useQuery } from "@tanstack/react-query";
import {
  BadgeCheck,
  ClipboardCheck,
  FileText,
  NotebookPen,
  Presentation,
  Trash2,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs } from "@/components/ui/Tabs";
import type { Locale } from "@/lib/i18n/config";
import { topicQueries } from "@/lib/topic-materials/queries";
import { formatDate } from "@/lib/utils/format-date";
import { useTopicNotesStore } from "@/stores/topic-notes.store";
import { SummaryBlocks } from "./SummaryBlocks";

export const TOPIC_TABS = ["summary", "slides", "notes", "test"] as const;
export type TopicTab = (typeof TOPIC_TABS)[number];

export interface TopicRef {
  /** Mundarija bo'limi id'si. */
  id: string;
  title: string;
}

export interface TopicPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tab: TopicTab;
  onTabChange: (tab: TopicTab) => void;
  topic: TopicRef;
  bookId: string;
  /** Bo'lim prezentatsiyasi (PDF slaydlar); yo'q bo'lsa `null`. */
  slides: { page_count: number } | null;
  /** Prezentatsiyani o'qish oynasining slayd ko'rgichida ochadi. */
  onOpenSlides: () => void;
  /** Desktop — o'ngda 480px panel, aks holda pastki sheet. */
  desktop: boolean;
}

function LoadError({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("topic");
  return (
    <div role="alert" className="flex flex-col items-start gap-3">
      <p className="text-danger text-sm">{t("loadError")}</p>
      <Button variant="secondary" onClick={onRetry}>
        {t("retry")}
      </Button>
    </div>
  );
}

function PanelSkeleton() {
  const t = useTranslations("topic");
  return (
    <div role="status" aria-label={t("loading")} className="flex flex-col gap-3">
      <Skeleton className="rounded-ds h-24 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

function SummaryTab({ topicId }: { topicId: string }) {
  const t = useTranslations("topic.summary");
  const locale = useLocale() as Locale;
  const summary = useQuery(topicQueries.summary(topicId));
  if (summary.isPending) return <PanelSkeleton />;
  if (summary.error) return <LoadError onRetry={() => void summary.refetch()} />;
  if (!summary.data || summary.data.blocks.length === 0) {
    return <EmptyState icon={FileText}>{t("empty")}</EmptyState>;
  }
  return (
    <div className="flex flex-col gap-4">
      <SummaryBlocks blocks={summary.data.blocks} />
      <p className="text-ds-muted text-xs">
        {t("updated", { date: formatDate(summary.data.updated_at, locale, "date") })}
      </p>
    </div>
  );
}

function SlidesTab({
  slides,
  onOpen,
}: {
  slides: { page_count: number } | null;
  onOpen: () => void;
}) {
  const t = useTranslations("topic.slides");
  if (!slides || slides.page_count === 0) {
    return <EmptyState icon={Presentation}>{t("empty")}</EmptyState>;
  }
  return (
    <div
      data-testid="topic-slides-card"
      className="border-ds-line bg-ds-surface rounded-ds flex items-center gap-3 border p-4"
    >
      <span className="bg-ds-accent-tint text-ds-accent-ink rounded-ds-sm flex size-11 shrink-0 items-center justify-center">
        <Presentation className="size-5" aria-hidden />
      </span>
      <p className="text-ds-ink min-w-0 flex-1 text-sm font-bold">
        {t("card", { count: slides.page_count })}
      </p>
      <Button
        onClick={onOpen}
        className="bg-ds-accent hover:bg-ds-accent-ink text-ds-on-accent rounded-ds-sm h-11"
      >
        {t("open")}
      </Button>
    </div>
  );
}

function NotesTab({ topicId, bookId }: { topicId: string; bookId: string }) {
  const t = useTranslations("topic.notes");
  const notes = useTopicNotesStore((state) => state.notes);
  const remove = useTopicNotesStore((state) => state.remove);
  const mine = notes.filter((note) => note.bookId === bookId && note.topicId === topicId);
  if (mine.length === 0) return <EmptyState icon={NotebookPen}>{t("empty")}</EmptyState>;
  return (
    <ul className="flex flex-col gap-2" data-testid="topic-notes">
      {mine.map((note) => (
        <li
          key={note.id}
          className="border-ds-line bg-ds-surface rounded-ds flex items-start gap-2 border p-3"
        >
          <blockquote className="text-ds-ink min-w-0 flex-1 text-sm leading-relaxed">
            <p>{note.text}</p>
            <footer className="text-ds-muted mt-1 text-xs tabular-nums">
              {t("page", { page: note.page })}
            </footer>
          </blockquote>
          <button
            type="button"
            aria-label={t("remove")}
            onClick={() => remove(note.id)}
            className="text-ds-muted hover:bg-ds-canvas hover:text-ds-ink rounded-ds-sm inline-flex size-11 shrink-0 items-center justify-center"
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}

/** Sarlavhadagi «Ustoz tekshirgan» belgisi: xulosa nashr qilingan bo'lsa. */
function VerifiedBadge({ topicId }: { topicId: string }) {
  const t = useTranslations("topic");
  const summary = useQuery(topicQueries.summary(topicId));
  if (summary.data?.status !== "published") return null;
  return (
    <span
      data-testid="topic-verified"
      className="bg-ds-ok-bg text-ds-ok-ink inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold"
    >
      <BadgeCheck className="size-3.5" aria-hidden />
      {t("verified")}
    </span>
  );
}

/**
 * Mavzu paneli (sarlavhadagi «Mavzu»): joriy bo'lim uchun Xulosa | Taqdimot | Konspekt | Test.
 * Desktopda o'ngda 480px, mobilda pastki sheet.
 */
export function TopicPanel({
  open,
  onOpenChange,
  tab,
  onTabChange,
  topic,
  bookId,
  slides,
  onOpenSlides,
  desktop,
}: TopicPanelProps) {
  const t = useTranslations("topic");
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      placement={desktop ? "right" : "bottom"}
      className="font-ui sm:max-w-[30rem]"
      title={
        <span className="flex flex-col items-start gap-1.5">
          <span className="text-ds-muted text-xs font-bold tracking-wide uppercase">
            {t("title")}
          </span>
          <span className="text-ds-ink text-pretty">{topic.title}</span>
          {open && <VerifiedBadge topicId={topic.id} />}
        </span>
      }
    >
      {open && (
        <div data-testid="topic-panel">
          <Tabs
            label={t("tabsLabel")}
            value={tab}
            onValueChange={(id) => onTabChange(id as TopicTab)}
            items={[
              {
                id: "summary",
                label: t("tabs.summary"),
                content: <SummaryTab topicId={topic.id} />,
              },
              {
                id: "slides",
                label: t("tabs.slides"),
                content: <SlidesTab slides={slides} onOpen={onOpenSlides} />,
              },
              {
                id: "notes",
                label: t("tabs.notes"),
                content: <NotesTab topicId={topic.id} bookId={bookId} />,
              },
              {
                id: "test",
                label: t("tabs.test"),
                content: <EmptyState icon={ClipboardCheck}>{t("testSoon")}</EmptyState>,
              },
            ]}
          />
        </div>
      )}
    </Dialog>
  );
}
