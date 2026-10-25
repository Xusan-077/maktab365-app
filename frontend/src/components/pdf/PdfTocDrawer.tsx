"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Circle, CircleDot, PencilLine, Presentation, Puzzle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Dialog } from "@/components/ui/Dialog";
import { Tabs } from "@/components/ui/Tabs";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { Annotation } from "@/lib/pdf/annotations";
import { readSlidesProgress } from "@/lib/pdf/slides";
import {
  currentTocItem,
  flattenToc,
  groupToc,
  tocStatuses,
  type TocChapter,
  type TocStatus,
} from "@/lib/pdf/toc";
import { cn } from "@/lib/utils/cn";
import { AnnotationsList } from "./AnnotationsListDialog";
import { TocTree } from "./TocTree";

const STATUS_ICON: Record<TocStatus, typeof Circle> = {
  read: CheckCircle2,
  current: CircleDot,
  unread: Circle,
};

/**
 * Mundarija ro'yxati: boblar bo'yicha yig'iladigan guruhlar (`TocTree`), har bo'lim holati
 * (o'qilgan / joriy / o'qilmagan), joriy bo'lim ichida mashq va masalalar, bosilsa shu betga o'tadi.
 */
export function PdfTocList({
  chapters,
  page,
  onGo,
  onOpenSlides,
  onPick,
  scrollOnMount = false,
}: {
  chapters: readonly TocChapter[];
  page: number;
  onGo: (page: number) => void;
  onOpenSlides?: (chapterId: string, slide: number) => void;
  /** Bo'lim tanlangach (drawer yopilishi uchun). */
  onPick?: () => void;
  /** Joriy bo'lim ko'rinadigan joyga keltirilsinmi (ochilgan drawer'da). */
  scrollOnMount?: boolean;
}) {
  const t = useTranslations("pdfBooks.toc");
  const ts = useTranslations("pdfBooks.slides");
  const currentRef = useRef<HTMLButtonElement>(null);
  const statuses = useMemo(() => tocStatuses(groupToc(chapters), page), [chapters, page]);

  useEffect(() => {
    if (scrollOnMount) currentRef.current?.scrollIntoView?.({ block: "center" });
  }, [scrollOnMount]);

  const go = (target: number) => {
    onGo(target);
    onPick?.();
  };

  return (
    <nav aria-label={t("title")}>
      <TocTree
        chapters={chapters}
        page={page}
        testId="pdf-toc"
        alwaysSearchable
        renderItem={(item, { active }) => {
          const slides = onOpenSlides ? item.slides : null;
          const saved = slides ? readSlidesProgress(item.id) : null;
          const resume = saved && slides && saved > 1 && saved <= slides.page_count ? saved : 1;
          const status = statuses.get(item.id) ?? "unread";
          const Icon = STATUS_ICON[status];
          const anchors = active ? (item.anchors ?? []) : [];
          return (
            <div className="flex flex-col gap-0.5">
              <div className="flex items-stretch gap-1">
                <button
                  type="button"
                  ref={active ? currentRef : undefined}
                  aria-current={active ? "location" : undefined}
                  data-testid="pdf-toc-item"
                  data-status={status}
                  onClick={() => go(item.page)}
                  className={cn(
                    "rounded-ds-sm flex min-h-11 min-w-0 flex-1 items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors",
                    item.level === 0 ? "font-semibold" : "text-ds-muted pl-6",
                    active
                      ? "bg-ds-accent-tint text-ds-accent-ink font-bold"
                      : "hover:bg-ds-canvas",
                  )}
                >
                  <Icon
                    aria-hidden
                    className={cn(
                      "size-4 shrink-0",
                      status === "read" && "text-ds-ok-ink",
                      status === "current" && "text-ds-accent",
                      status === "unread" && "text-ds-muted",
                    )}
                  />
                  <span className="sr-only">{t(`status.${status}`)}</span>
                  <span className="min-w-0 flex-1 text-pretty">{item.title}</span>
                  <span className="text-ds-muted shrink-0 font-medium tabular-nums">
                    {t("page", { page: item.page })}
                  </span>
                </button>
                {slides && (
                  <button
                    type="button"
                    data-testid="pdf-toc-slides"
                    aria-label={ts("openLabel", { title: item.title, count: slides.page_count })}
                    title={resume > 1 ? ts("resume", { slide: resume }) : ts("open")}
                    onClick={() => {
                      onOpenSlides?.(item.id, resume);
                      onPick?.();
                    }}
                    className="text-ds-accent-ink hover:bg-ds-accent-tint rounded-ds-sm inline-flex min-h-11 shrink-0 items-center gap-1.5 px-3 text-sm font-semibold transition-colors"
                  >
                    <Presentation className="size-4" aria-hidden />
                    <span className="max-sm:sr-only">
                      {resume > 1 ? ts("resumeShort") : ts("open")}
                    </span>
                  </button>
                )}
              </div>
              {anchors.length > 0 && (
                <ul aria-label={t("anchors")} className="flex flex-col gap-0.5 pl-9">
                  {anchors.map((anchor) => {
                    const AnchorIcon = anchor.kind === "exercise" ? PencilLine : Puzzle;
                    return (
                      <li key={`${anchor.kind}-${anchor.page}-${anchor.title}`}>
                        <button
                          type="button"
                          data-testid="pdf-toc-anchor"
                          onClick={() => go(anchor.page)}
                          className="text-ds-muted hover:bg-ds-canvas hover:text-ds-ink rounded-ds-sm flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm"
                        >
                          <AnchorIcon className="size-4 shrink-0" aria-hidden />
                          <span className="min-w-0 flex-1">{anchor.title}</span>
                          <span className="shrink-0 tabular-nums">
                            {t("page", { page: anchor.page })}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        }}
      />
    </nav>
  );
}

/** «Davom ettirish»: oxirgi saqlangan joy (ochilgandagi pozitsiya) joriy betdan farq qilsa. */
function ResumeCard({
  chapters,
  page,
  resume,
  total,
  onResume,
}: {
  chapters: readonly TocChapter[];
  page: number;
  resume: number | null;
  total: number;
  onResume: (page: number) => void;
}) {
  const t = useTranslations("pdfBooks.toc");
  const target = resume ?? page;
  const section = currentTocItem(flattenToc(chapters), target)?.title;
  const percent = total > 0 ? Math.max(1, Math.round((target / total) * 100)) : 0;
  const elsewhere = resume !== null && resume !== page;
  return (
    <section
      aria-label={t("resumeTitle")}
      data-testid="pdf-toc-resume"
      className="bg-ds-accent-tint text-ds-ink rounded-ds flex items-center gap-3 p-3"
    >
      <div className="min-w-0 flex-1">
        <p className="text-ds-accent-ink text-xs font-bold tracking-wide uppercase">
          {t(elsewhere ? "resumeTitle" : "hereTitle")}
        </p>
        <p className="truncate text-sm font-semibold">{section ?? t("page", { page: target })}</p>
        <p className="text-ds-muted text-xs tabular-nums">
          {t("resumeMeta", { page: target, total, percent })}
        </p>
      </div>
      {elsewhere && (
        <button
          type="button"
          data-testid="pdf-toc-resume-go"
          onClick={() => onResume(target)}
          className="bg-ds-accent text-ds-on-accent hover:bg-ds-accent-ink rounded-ds-sm h-11 shrink-0 px-4 text-sm font-bold"
        >
          {t("resume")}
        </button>
      )}
    </section>
  );
}

export interface PdfTocDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chapters: readonly TocChapter[];
  /** Joriy sahifa: shu sahifaga to'g'ri keladigan bo'lim ajratib ko'rsatiladi. */
  page: number;
  total: number;
  /** O'qish oynasi ochilgandagi saqlangan joy («Davom ettirish» kartasi); yo'q — `null`. */
  resume: number | null;
  onGo: (page: number) => void;
  /** Prezentatsiyasi bor bo'lim belgisi bosilganda (bo'lim id'si, boshlanadigan slayd). */
  onOpenSlides?: (chapterId: string, slide: number) => void;
  annotations: Annotation[];
  onPickAnnotation: (annotation: Annotation) => void;
}

const MOBILE_QUERY = "(max-width: 639px)";

/**
 * Mundarija drawer'i (sarlavhadagi kitob nomi yoki M): tepada «Davom ettirish», yorliqlar
 * «Mundarija | Belgilar». Mobilda pastdan, kattaroq ekranda chapdan.
 */
export function PdfTocDrawer({
  open,
  onOpenChange,
  chapters,
  page,
  total,
  resume,
  onGo,
  onOpenSlides,
  annotations,
  onPickAnnotation,
}: PdfTocDrawerProps) {
  const t = useTranslations("pdfBooks.toc");
  const tt = useTranslations("pdfBooks.reader.tabs");
  const mobile = useMediaQuery(MOBILE_QUERY);
  const [tab, setTab] = useState<"toc" | "marks">(chapters.length > 0 ? "toc" : "marks");
  const close = () => onOpenChange(false);

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("title")}
      placement={mobile ? "bottom" : "left"}
      className="font-ui sm:max-w-[26rem]"
    >
      {open && (
        <div className="flex flex-col gap-4" data-testid="pdf-toc-drawer">
          <ResumeCard
            chapters={chapters}
            page={page}
            resume={resume}
            total={total}
            onResume={(target) => {
              onGo(target);
              close();
            }}
          />
          <Tabs
            label={tt("label")}
            value={tab}
            onValueChange={(id) => setTab(id as "toc" | "marks")}
            items={[
              ...(chapters.length > 0
                ? [
                    {
                      id: "toc",
                      label: <span data-testid="reader-tab-toc">{tt("toc")}</span>,
                      content: (
                        <PdfTocList
                          chapters={chapters}
                          page={page}
                          onGo={onGo}
                          onOpenSlides={onOpenSlides}
                          onPick={close}
                          scrollOnMount
                        />
                      ),
                    },
                  ]
                : []),
              {
                id: "marks",
                label: (
                  <span data-testid="reader-tab-marks">
                    {tt("marks")}
                    {annotations.length > 0 && (
                      <span className="text-ds-muted ml-1 tabular-nums">{annotations.length}</span>
                    )}
                  </span>
                ),
                content: (
                  <AnnotationsList
                    items={annotations}
                    onPick={(annotation) => {
                      onPickAnnotation(annotation);
                      close();
                    }}
                  />
                ),
              },
            ]}
          />
        </div>
      )}
    </Dialog>
  );
}
