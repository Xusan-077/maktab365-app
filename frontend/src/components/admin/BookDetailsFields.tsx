"use client";

import { useTranslations } from "next-intl";
import { Textarea } from "@/components/ui/Textarea";
import { DESCRIPTION_MAX, countRows, toPayload, type ChapterDraft } from "@/lib/admin/chapters";
import type { AdminPdfBookPatch } from "@/lib/admin/types";
import type { SlidesContext } from "./ChapterSlides";
import { ChaptersEditor } from "./ChaptersEditor";

export interface BookDetailsValue {
  description: string;
  chapters: ChapterDraft[];
}

export interface BookDetailsFieldsProps {
  value: BookDetailsValue;
  onChange: (next: BookDetailsValue) => void;
  /** PDF betlari soni (yuklangan bo'lsa). */
  pageCount?: number;
  disabled?: boolean;
  showProblems?: boolean;
  /** Backend xatosi matni (masalan, bet PDF dan katta). */
  chaptersError?: string;
  descriptionError?: string;
  /** Bo'lim prezentatsiyalari konteksti (berilmasa boshqaruv ko'rinmaydi). */
  slides?: SlidesContext;
}

/** `PATCH` tanasi: tavsif va mundarija (bo'sh qatorlar tashlanadi). */
export const toDetailsPatch = (value: BookDetailsValue): AdminPdfBookPatch => ({
  description: value.description.trim(),
  chapters: toPayload(value.chapters),
});

/** Tavsif yoki mundarija kiritilganmi (o'tkazib yuborilganda yuborilmaydi). */
export const hasDetails = (value: BookDetailsValue) =>
  Boolean(value.description.trim()) || countRows(value.chapters) > 0;

/** Kitob tavsifi va mundarijasi: yangi kitob qadamida ham, tahrirlash sahifasida ham shu. */
export function BookDetailsFields({
  value,
  onChange,
  pageCount,
  disabled,
  showProblems,
  chaptersError,
  descriptionError,
  slides,
}: BookDetailsFieldsProps) {
  const t = useTranslations("admin.details");
  return (
    <div className="flex flex-col gap-6">
      <Textarea
        label={t("description")}
        hint={t("descriptionHint", { count: value.description.length, max: DESCRIPTION_MAX })}
        error={descriptionError}
        value={value.description}
        maxLength={DESCRIPTION_MAX}
        rows={4}
        disabled={disabled}
        data-testid="pdf-description-input"
        onChange={(event) => onChange({ ...value, description: event.target.value })}
      />
      <ChaptersEditor
        value={value.chapters}
        onChange={(chapters) => onChange({ ...value, chapters })}
        pageCount={pageCount}
        disabled={disabled}
        showProblems={showProblems}
        slides={slides}
      />
      {chaptersError && (
        <p role="alert" className="text-danger text-sm" data-testid="chapters-error">
          {chaptersError}
        </p>
      )}
    </div>
  );
}
