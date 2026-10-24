"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import type { Annotation } from "@/lib/pdf/annotations";
import type { TocChapter } from "@/lib/pdf/toc";
import { cn } from "@/lib/utils/cn";
import { AnnotationsList } from "../AnnotationsListDialog";
import { PdfBookDescription } from "../PdfBookDescription";
import { PdfTocList } from "../PdfTocDrawer";

type Tab = "toc" | "marks" | "about";

export interface ReaderPanelProps {
  chapters: readonly TocChapter[];
  page: number;
  description: string;
  annotations: Annotation[];
  onGo: (page: number) => void;
  onOpenSlides?: (chapterId: string, slide: number) => void;
  onPickAnnotation: (annotation: Annotation) => void;
  /** Tanlovdan keyin (mobil sheet'ni yopish uchun). */
  onPick?: () => void;
  scrollOnMount?: boolean;
  className?: string;
}

/** Yon panel: «Mundarija / Belgilar / Tavsif» (desktopda chap ustun, mobilda pastki sheet ichida). */
export function ReaderPanel({
  chapters,
  page,
  description,
  annotations,
  onGo,
  onOpenSlides,
  onPickAnnotation,
  onPick,
  scrollOnMount,
  className,
}: ReaderPanelProps) {
  const t = useTranslations("pdfBooks.reader.tabs");
  const id = useId();
  const tabs: Tab[] = [
    ...(chapters.length > 0 ? (["toc"] as const) : []),
    "marks",
    ...(description.trim() ? (["about"] as const) : []),
  ];
  const [chosen, setChosen] = useState<Tab>("toc");
  const active = tabs.includes(chosen) ? chosen : tabs[0];

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div
        role="tablist"
        aria-label={t("label")}
        className="bg-surface-2 grid gap-1 rounded-xl p-1"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {tabs.map((tab) => (
          <button
            key={tab}
            id={`${id}-${tab}`}
            type="button"
            role="tab"
            aria-selected={active === tab}
            aria-controls={`${id}-panel`}
            data-testid={`reader-tab-${tab}`}
            onClick={() => setChosen(tab)}
            className={cn(
              "h-10 rounded-[0.5625rem] text-sm transition-colors",
              active === tab
                ? "bg-surface text-foreground font-bold shadow-sm"
                : "text-muted hover:text-foreground font-medium",
            )}
          >
            {t(tab)}
          </button>
        ))}
      </div>
      <div id={`${id}-panel`} role="tabpanel" aria-labelledby={`${id}-${active}`}>
        {active === "toc" && (
          <PdfTocList
            chapters={chapters}
            page={page}
            onGo={onGo}
            onOpenSlides={onOpenSlides}
            onPick={onPick}
            scrollOnMount={scrollOnMount}
          />
        )}
        {active === "marks" && (
          <AnnotationsList
            items={annotations}
            onPick={(annotation) => {
              onPickAnnotation(annotation);
              onPick?.();
            }}
          />
        )}
        {active === "about" && <PdfBookDescription text={description} />}
      </div>
    </div>
  );
}
