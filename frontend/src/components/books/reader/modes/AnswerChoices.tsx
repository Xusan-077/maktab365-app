"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ANSWER_MAX_LENGTH } from "@/lib/books/test-mode";
import { cn } from "@/lib/utils/cn";

export interface AnswerChoicesProps {
  /** Savol raqami (ekran o'qigichlar uchun yorliq). */
  question: number;
  kind: "choice" | "text";
  letters: readonly string[];
  value: string | undefined;
  /** Bo'sh qiymat — javobni o'chirish. */
  onChange: (value: string) => void;
  className?: string;
  /** Tor ekran (tez panel): tugmalar 36 px. */
  dense?: boolean;
}

function TextAnswer({
  question,
  value,
  onChange,
}: Pick<AnswerChoicesProps, "question" | "value" | "onChange">) {
  const t = useTranslations("books.test");
  const [draft, setDraft] = useState(value ?? "");
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    // Tashqaridan o'zgardi (optimistik qaytarish yoki boshqa panel): maydon ham yangilanadi.
    setSeen(value);
    setDraft(value ?? "");
  }
  const commit = () => {
    if (draft.trim() !== (value ?? "")) onChange(draft.trim());
  };
  return (
    <input
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
          event.currentTarget.blur();
        }
      }}
      maxLength={ANSWER_MAX_LENGTH}
      aria-label={t("answerLabel", { question })}
      placeholder={t("textPlaceholder")}
      className="border-bk-line bg-bk-paper text-bk-ink placeholder:text-bk-muted h-11 min-w-0 flex-1 rounded-lg border px-3 text-base"
    />
  );
}

/** Bitta savolga javob: variant harflari (A–D/E) yoki matn maydoni. Tanlangan harfni qayta bosish — o'chirish. */
export function AnswerChoices({
  question,
  kind,
  letters,
  value,
  onChange,
  className,
  dense = false,
}: AnswerChoicesProps) {
  const t = useTranslations("books.test");

  if (kind === "text") {
    return (
      <div className={cn("flex min-w-0 items-center gap-2", className)}>
        <TextAnswer question={question} value={value} onChange={onChange} />
      </div>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label={t("answerLabel", { question })}
      className={cn("flex items-center gap-1", className)}
    >
      {letters.map((letter) => {
        const selected = value?.toUpperCase() === letter;
        return (
          <button
            key={letter}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={t("choice", { letter })}
            data-answer-choice={letter}
            onClick={() => onChange(selected ? "" : letter)}
            className={cn(
              "inline-flex size-11 items-center justify-center rounded-lg border text-base font-semibold transition-colors",
              dense && "max-sm:size-9",
              selected
                ? "border-bk-accent bg-bk-accent text-white"
                : "border-bk-line hover:bg-bk-accent-soft",
            )}
          >
            {letter}
          </button>
        );
      })}
    </div>
  );
}
