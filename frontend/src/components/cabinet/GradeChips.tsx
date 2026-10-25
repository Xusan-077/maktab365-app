"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";
import { Chip } from "@/components/ui/Chip";
import { GRADES } from "@/types/catalog";

interface GradeChipsBaseProps {
  label: string;
  error?: string;
  onBlur?: () => void;
}

type GradeChipsProps = GradeChipsBaseProps &
  (
    | { multiple?: false; value: number | undefined; onChange: (grade: number) => void }
    | { multiple: true; value: number[]; onChange: (grades: number[]) => void }
  );

/** 1–11-sinf chip tugmalari: bitta (o'quvchi) yoki bir nechta (o'qituvchi) tanlov. */
export function GradeChips(props: GradeChipsProps) {
  const t = useTranslations("onboarding");
  const errorId = useId();
  const selected = (grade: number) =>
    props.multiple ? props.value.includes(grade) : props.value === grade;

  const toggle = (grade: number) => {
    if (!props.multiple) return props.onChange(grade);
    const next = selected(grade)
      ? props.value.filter((value) => value !== grade)
      : [...props.value, grade].sort((a, b) => a - b);
    props.onChange(next);
  };

  return (
    <fieldset
      className="flex flex-col gap-2"
      aria-invalid={props.error ? true : undefined}
      aria-describedby={props.error ? errorId : undefined}
      onBlur={props.onBlur}
    >
      <legend className="mb-1 text-sm font-medium">{props.label}</legend>
      <div className="grid grid-cols-6 gap-2 sm:grid-cols-11">
        {GRADES.map((grade) => (
          <Chip
            key={grade}
            selected={selected(grade)}
            onClick={() => toggle(grade)}
            aria-label={t("gradeOption", { grade })}
            className="justify-center px-0 tabular-nums"
          >
            {grade}
          </Chip>
        ))}
      </div>
      {props.error && (
        <p id={errorId} role="alert" className="text-danger text-sm">
          {props.error}
        </p>
      )}
    </fieldset>
  );
}
