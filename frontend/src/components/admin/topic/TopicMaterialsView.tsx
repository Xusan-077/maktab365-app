"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClipboardCheck, ExternalLink, NotebookPen } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { buttonVariants } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tabs } from "@/components/ui/Tabs";
import { adminQueries } from "@/lib/admin/queries";
import { adminPdfBookPath } from "@/lib/admin/routes";
import type { AdminChapter } from "@/lib/admin/types";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { Link } from "@/lib/i18n/navigation";
import { readerPath } from "@/lib/utils/routes";
import { QueryError } from "../QueryError";
import { PresentationEditor } from "./PresentationEditor";
import { SummaryEditor } from "./SummaryEditor";

export const TOPIC_EDITOR_TABS = ["main", "summary", "slides", "notes", "test"] as const;
export type TopicEditorTab = (typeof TOPIC_EDITOR_TABS)[number];

interface FoundTopic {
  title: string;
  page: number;
  /** Bob ichidagi bo'lim bo'lsa — bob nomi. */
  parent?: string;
  /** Mundarijadagi tartib raqami: "2" yoki "2.1". */
  position: string;
}

/** Mundarija daraxtidan bo'limni id bo'yicha topadi (bob yoki uning bo'limi). */
export function findTopic(chapters: readonly AdminChapter[], id: string): FoundTopic | null {
  for (const [index, chapter] of chapters.entries()) {
    if (chapter.id === id) {
      return { title: chapter.title, page: chapter.page, position: String(index + 1) };
    }
    const childIndex = chapter.children?.findIndex((item) => item.id === id) ?? -1;
    const child = chapter.children?.[childIndex];
    if (child) {
      return {
        title: child.title,
        page: child.page,
        parent: chapter.title,
        position: `${index + 1}.${childIndex + 1}`,
      };
    }
  }
  return null;
}

function MainTab({ topic, readerHref }: { topic: FoundTopic; readerHref: string }) {
  const t = useTranslations("admin.topic.main");
  const rows: [string, string][] = [
    [t("title"), topic.title],
    ...(topic.parent ? ([[t("chapter"), topic.parent]] as [string, string][]) : []),
    [t("page"), String(topic.page)],
  ];
  return (
    <div className="flex flex-col gap-4">
      <dl className="border-border bg-surface grid gap-x-6 gap-y-3 rounded-xl border p-4 text-sm sm:grid-cols-[auto_1fr]">
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted">{label}</dt>
            <dd className="text-foreground font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-muted text-sm">{t("hint")}</p>
      <div>
        <Link
          href={readerHref}
          target="_blank"
          rel="noopener"
          className={buttonVariants({ variant: "secondary" })}
        >
          <ExternalLink className="size-4" aria-hidden />
          {t("openReader")}
        </Link>
      </div>
    </div>
  );
}

/**
 * Admin: mavzu (mundarija bo'limi) materiallari — Asosiy | Xulosa | Taqdimot | Konspekt | Test.
 * Mavzu id'si = bo'lim id'si (`chapters[].id`); nomi va beti kitob mundarijasida tahrirlanadi.
 */
export function TopicMaterialsView({ bookId, topicId }: { bookId: string; topicId: string }) {
  const t = useTranslations("admin.topic");
  const locale = useLocale() as Locale;
  const [tab, setTab] = useState<TopicEditorTab>("summary");
  const { data: book, error, isPending, refetch } = useQuery(adminQueries.pdfBook(bookId));

  if (error) return <QueryError error={error} onRetry={() => void refetch()} />;
  if (isPending) return <Skeleton className="h-96" />;

  const topic = findTopic(book.chapters ?? [], topicId);
  const backLink = (
    <Link
      href={adminPdfBookPath(bookId)}
      className="text-link -mt-4 text-sm font-medium underline-offset-4 hover:underline"
    >
      {t("backToBook")}
    </Link>
  );

  if (!topic) {
    return (
      <>
        <PageHeader title={t("notFoundTitle")} />
        {backLink}
        <EmptyState icon={NotebookPen}>{t("notFound")}</EmptyState>
      </>
    );
  }

  const readerHref = readerPath(book, topic.page);

  return (
    <>
      <PageHeader title={topic.title} description={getLocalized(book.title, locale)} />
      {backLink}
      <Tabs
        label={t("tabsLabel")}
        keepMounted
        value={tab}
        onValueChange={(id) => setTab(id as TopicEditorTab)}
        items={[
          {
            id: "main",
            label: t("tabs.main"),
            content: <MainTab topic={topic} readerHref={readerHref} />,
          },
          {
            id: "summary",
            label: t("tabs.summary"),
            content: <SummaryEditor topicId={topicId} />,
          },
          {
            id: "slides",
            label: t("tabs.slides"),
            content: (
              <PresentationEditor
                book={book}
                topicId={topicId}
                title={topic.title}
                position={topic.position}
              />
            ),
          },
          {
            id: "notes",
            label: t("tabs.notes"),
            content: <EmptyState icon={NotebookPen}>{t("soon.notes")}</EmptyState>,
          },
          {
            id: "test",
            label: t("tabs.test"),
            content: <EmptyState icon={ClipboardCheck}>{t("soon.test")}</EmptyState>,
          },
        ]}
      />
    </>
  );
}
