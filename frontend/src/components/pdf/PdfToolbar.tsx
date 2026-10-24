"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { parsePageInput } from "@/lib/pdf/page-nav";
import { cn } from "@/lib/utils/cn";

export interface PdfToolbarProps {
  page: number;
  total: number;
  onGo: (page: number) => void;
  disabled?: boolean;
  /** Oldingi/keyingi tugma manzili (yoymada 2 betga); aytilmasa ±1, `null` — tugma o'chiq. */
  prevPage?: number | null;
  nextPage?: number | null;
  /** `inline` — yuqori panel (desktop); `bar` — mobil pastki panel (keyingi tugma to'ldirilgan). */
  variant?: "inline" | "bar";
}

const NAV_BUTTON =
  "text-foreground inline-flex size-11 shrink-0 items-center justify-center rounded-xl transition-colors disabled:pointer-events-none disabled:opacity-40";

/** Oldingi/keyingi tugmalari va sahifa raqami maydoni ("12 / 240"). Enter yoki fokus ketganda o'tadi. */
export function PdfToolbar({
  page,
  total,
  onGo,
  disabled,
  prevPage = page > 1 ? page - 1 : null,
  nextPage = page < total ? page + 1 : null,
  variant = "inline",
}: PdfToolbarProps) {
  const t = useTranslations("pdfBooks.reader");
  const bar = variant === "bar";
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
      className={cn("flex items-center gap-1.5", bar ? "w-full" : "justify-center")}
      data-testid="pdf-toolbar"
    >
      <button
        type="button"
        aria-label={t("prev")}
        data-testid="pdf-prev"
        disabled={disabled || prevPage === null}
        onClick={() => prevPage !== null && onGo(prevPage)}
        className={cn(NAV_BUTTON, bar ? "bg-surface-2" : "border-border bg-surface border")}
      >
        <ChevronLeft className="size-5" aria-hidden />
      </button>

      <div
        className={cn(
          "flex items-center justify-center gap-1.5 text-[0.9375rem] tabular-nums",
          bar ? "h-11 flex-1" : "bg-surface-2 h-11 rounded-xl px-3",
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
          className="border-input-border bg-surface text-foreground focus-visible:ring-ring h-8 rounded-lg border px-1 text-center font-bold"
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

      <button
        type="button"
        aria-label={t("next")}
        data-testid="pdf-next"
        disabled={disabled || nextPage === null}
        onClick={() => nextPage !== null && onGo(nextPage)}
        className={cn(NAV_BUTTON, bar ? "bg-brand text-white" : "border-border bg-surface border")}
      >
        <ChevronRight className="size-5" aria-hidden />
      </button>
    </div>
  );
}
