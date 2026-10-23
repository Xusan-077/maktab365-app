"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { formatGrades, GRADE_PRESETS, normalizeGrades, parseGradeRange } from "@/lib/admin/grades";
import { GRADES } from "@/types/catalog";

export interface GradePickerProps {
  value: number[];
  onChange: (grades: number[]) => void;
  error?: string;
  disabled?: boolean;
}

const PRESETS = [
  ["all", "presetAll"],
  ["primary", "presetPrimary"],
  ["middle", "presetMiddle"],
  ["high", "presetHigh"],
] as const;

/** Fan sinflari: 1..11 chiplari, tezkor tugmalar va oraliq kiritish ("5–11"). */
export function GradePicker({ value, onChange, error, disabled }: GradePickerProps) {
  const t = useTranslations("admin.subjects");
  const rangeId = useId();
  const [range, setRange] = useState("");

  const toggle = (grade: number) =>
    onChange(
      value.includes(grade) ? value.filter((g) => g !== grade) : normalizeGrades([...value, grade]),
    );
  const applyRange = () => {
    const parsed = parseGradeRange(range);
    if (parsed.length > 0) {
      onChange(parsed);
      setRange("");
    }
  };

  return (
    <fieldset className="flex flex-col gap-2" data-testid="grade-picker" disabled={disabled}>
      <legend className="text-sm font-medium">{t("gradesLabel")}</legend>
      <p className="text-muted text-sm">{t("gradesHint")}</p>
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map(([key, label]) => (
          <Button
            key={key}
            variant="secondary"
            size="sm"
            data-testid={`grades-preset-${key}`}
            onClick={() => onChange([...GRADE_PRESETS[key]])}
          >
            {t(label)}
          </Button>
        ))}
        <Button
          variant="ghost"
          size="sm"
          data-testid="grades-preset-clear"
          onClick={() => onChange([])}
        >
          {t("presetClear")}
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("gradesLabel")}>
        {GRADES.map((grade) => (
          <Chip
            key={grade}
            selected={value.includes(grade)}
            aria-label={t("gradeChip", { grade })}
            data-testid={`grade-chip-${grade}`}
            className="min-w-11 justify-center px-3"
            onClick={() => toggle(grade)}
          >
            {grade}
          </Chip>
        ))}
      </div>
      <div className="flex items-end gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={rangeId} className="text-muted text-xs">
            {t("rangeLabel")}
          </label>
          <input
            id={rangeId}
            value={range}
            onChange={(event) => setRange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                applyRange();
              }
            }}
            inputMode="numeric"
            placeholder="5–11"
            data-testid="grades-range"
            className="border-border bg-surface h-9 w-36 rounded-lg border px-3 text-sm"
          />
        </div>
        <Button variant="secondary" size="sm" data-testid="grades-range-apply" onClick={applyRange}>
          {t("rangeApply")}
        </Button>
      </div>
      {value.length > 0 && (
        <p className="text-muted text-sm" aria-live="polite">
          {t("gradesSelected", { value: formatGrades(value) })}
        </p>
      )}
      {error && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}
    </fieldset>
  );
}
