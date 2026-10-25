"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { parsePageInput } from "@/lib/pdf/page-nav";
import { cn } from "@/lib/utils/cn";

export interface PageNumberInputProps {
  page: number;
  total: number;
  onGo: (page: number) => void;
  disabled?: boolean;
  className?: string;
}

/** Bet raqami maydoni ("77 / 240"): Enter yoki fokus ketganda o'tadi, Escape bekor qiladi. */
export function PageNumberInput({ page, total, onGo, disabled, className }: PageNumberInputProps) {
  const t = useTranslations("pdfBooks.reader");
  // `null` — maydon joriy sahifani ko'rsatadi; tahrir paytida foydalanuvchi matni.
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft === null) return;
    setDraft(null);
    const next = parsePageInput(draft, page, total);
    if (next !== page) onGo(next);
  };

  return (
    <div
      className={cn(
        "bg-ds-canvas text-ds-ink rounded-ds-sm flex h-11 items-center justify-center gap-1.5 px-2 text-[0.9375rem] tabular-nums",
        className,
      )}
    >
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        aria-label={t("pageInput")}
        data-testid="pdf-page-input"
        value={draft ?? String(page)}
        disabled={disabled}
        style={{ width: `${String(total).length + 2}ch` }}
        className="border-ds-line bg-ds-surface text-ds-ink h-8 rounded-lg border px-1 text-center font-bold"
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
            event.currentTarget.blur();
          } else if (event.key === "Escape") {
            setDraft(null);
            event.currentTarget.blur();
          }
        }}
      />
      <span aria-hidden data-testid="pdf-page-total" className="text-ds-muted">
        / {total}
      </span>
      <span className="sr-only" role="status" aria-live="polite">
        {t("position", { page, total })}
      </span>
    </div>
  );
}
