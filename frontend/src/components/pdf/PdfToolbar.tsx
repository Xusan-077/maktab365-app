"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { parsePageInput } from "@/lib/pdf/page-nav";

export interface PdfToolbarProps {
  page: number;
  total: number;
  onGo: (page: number) => void;
  disabled?: boolean;
}

/** Oldingi/keyingi tugmalari va sahifa raqami maydoni ("12 / 240"). Enter yoki fokus ketganda o'tadi. */
export function PdfToolbar({ page, total, onGo, disabled }: PdfToolbarProps) {
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
      role="toolbar"
      aria-label={t("toolbar")}
      className="flex items-center justify-center gap-2"
      data-testid="pdf-toolbar"
    >
      <Button
        variant="secondary"
        aria-label={t("prev")}
        data-testid="pdf-prev"
        disabled={disabled || page <= 1}
        onClick={() => onGo(page - 1)}
      >
        <ChevronLeft className="size-5" aria-hidden />
      </Button>

      <div className="flex items-center gap-1.5 text-sm tabular-nums">
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
          className="border-border bg-surface text-foreground focus-visible:ring-ring h-10 rounded-lg border px-1 text-center"
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
        <span aria-hidden data-testid="pdf-page-total" className="text-muted">
          / {total}
        </span>
        <span className="sr-only" role="status" aria-live="polite">
          {t("position", { page, total })}
        </span>
      </div>

      <Button
        variant="secondary"
        aria-label={t("next")}
        data-testid="pdf-next"
        disabled={disabled || page >= total}
        onClick={() => onGo(page + 1)}
      >
        <ChevronRight className="size-5" aria-hidden />
      </Button>
    </div>
  );
}
