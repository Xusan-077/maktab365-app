"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ClipboardCheck, PencilLine } from "lucide-react";
import { useTranslations } from "next-intl";
import { currentTocItem, sectionLabel, tocMarkers, type TocItem } from "@/lib/pdf/toc";
import { cn } from "@/lib/utils/cn";
import { READER_ICON_BUTTON, READER_PILL_BUTTON } from "./reader-styles";

export interface ReaderFloatingNavProps {
  page: number;
  total: number;
  /** Mundarija (tekis): slider belgilari va tooltip'dagi bo'lim. */
  items: readonly TocItem[];
  prevPage: number | null;
  nextPage: number | null;
  onGo: (page: number) => void;
  /** Joriy bo'limning birinchi mashqi (bo'lsa) — «Mashqlar» tugmasi shu betga o'tadi. */
  exercisePage?: number | null;
  /** «Test» — mavzu panelining Test yorlig'i; berilmasa tugma yo'q. */
  onTest?: () => void;
}

/** "77-bet · 15-§": bo'lim sarlavhasida § belgisi bo'lmasa — sarlavhaning o'zi. */
function useThumbLabel(items: readonly TocItem[]) {
  const t = useTranslations("pdfBooks.nav");
  return (page: number) => {
    const item = currentTocItem(items, page);
    const section = item ? (sectionLabel(item.title) ?? item.title) : null;
    return section ? t("thumbWithSection", { page, section }) : t("thumb", { page });
  };
}

/**
 * Pastdagi suzuvchi panel: oldingi/keyingi, bet slayderi (bo'lim boshlanishlari belgilari bilan,
 * surish/fokus paytida tepasida "77-bet · 15-§"), «Mashqlar» va «Test». Slayder sudralganda bet
 * qo'yib yuborilgach almashadi (har pikselda canvas qayta chizilmasin); strelkalar — darhol.
 */
export function ReaderFloatingNav({
  page,
  total,
  items,
  prevPage,
  nextPage,
  onGo,
  exercisePage,
  onTest,
}: ReaderFloatingNavProps) {
  const t = useTranslations("pdfBooks.nav");
  const tr = useTranslations("pdfBooks.reader");
  const thumbLabel = useThumbLabel(items);
  const markers = useMemo(() => tocMarkers(items, total), [items, total]);
  // Sudrash paytidagi qiymat; `null` — joriy bet.
  const [draft, setDraft] = useState<number | null>(null);
  const [active, setActive] = useState(false);
  const shown = draft ?? page;
  const at = total > 1 ? (shown - 1) / (total - 1) : 0;

  const commit = () => {
    if (draft !== null && draft !== page) onGo(draft);
    setDraft(null);
  };

  return (
    <nav
      aria-label={t("label")}
      data-testid="reader-floating-nav"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] print:hidden"
    >
      <div className="border-ds-line bg-ds-surface/95 text-ds-ink rounded-ds-lg pointer-events-auto flex w-full max-w-3xl items-center gap-1 border p-1.5 shadow-lg backdrop-blur sm:gap-2">
        <button
          type="button"
          aria-label={tr("prev")}
          data-testid="pdf-prev"
          disabled={prevPage === null}
          onClick={() => prevPage !== null && onGo(prevPage)}
          className={READER_ICON_BUTTON}
        >
          <ChevronLeft className="size-5" aria-hidden />
        </button>

        <div className="relative flex h-11 min-w-0 flex-1 items-center px-2">
          <div aria-hidden className="bg-ds-line absolute inset-x-2 h-1 rounded-full">
            <div className="bg-ds-accent h-1 rounded-full" style={{ width: `${at * 100}%` }} />
            {markers.map((marker) => (
              <span
                key={marker.id}
                data-testid="reader-slider-marker"
                className={cn(
                  "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full",
                  marker.level === 0 ? "bg-ds-ink/50 h-3 w-0.5" : "bg-ds-ink/30 h-2 w-0.5",
                )}
                style={{ left: `${marker.at * 100}%` }}
              />
            ))}
          </div>
          {active && (
            <span
              aria-hidden
              data-testid="reader-slider-tooltip"
              className="bg-ds-ink text-ds-surface pointer-events-none absolute bottom-full mb-2 -translate-x-1/2 rounded-lg px-2.5 py-1 text-xs font-semibold whitespace-nowrap shadow-md"
              style={{ left: `calc(0.5rem + ${at} * (100% - 1rem))` }}
            >
              {thumbLabel(shown)}
            </span>
          )}
          <input
            type="range"
            min={1}
            max={Math.max(1, total)}
            step={1}
            value={shown}
            aria-label={t("slider")}
            aria-valuetext={thumbLabel(shown)}
            data-testid="reader-slider"
            onChange={(event) => setDraft(Number(event.target.value))}
            onPointerDown={() => setActive(true)}
            onPointerUp={commit}
            onKeyUp={commit}
            onFocus={() => setActive(true)}
            onBlur={() => {
              setActive(false);
              commit();
            }}
            onMouseEnter={() => setActive(true)}
            onMouseLeave={(event) => {
              if (document.activeElement !== event.currentTarget) setActive(false);
            }}
            className="reader-slider relative h-11 w-full cursor-pointer appearance-none bg-transparent"
          />
        </div>

        <span
          aria-hidden
          className="text-ds-muted hidden shrink-0 text-xs font-semibold tabular-nums sm:inline"
        >
          {t("count", { page: shown, total })}
        </span>

        {exercisePage != null && (
          <button
            type="button"
            data-testid="reader-exercises"
            onClick={() => onGo(exercisePage)}
            className={READER_PILL_BUTTON}
          >
            <PencilLine className="size-4" aria-hidden />
            <span className="max-sm:sr-only">{t("exercises")}</span>
          </button>
        )}
        {onTest && (
          <button
            type="button"
            data-testid="reader-test"
            onClick={onTest}
            className={READER_PILL_BUTTON}
          >
            <ClipboardCheck className="size-4" aria-hidden />
            <span className="max-sm:sr-only">{t("test")}</span>
          </button>
        )}

        <button
          type="button"
          aria-label={tr("next")}
          data-testid="pdf-next"
          disabled={nextPage === null}
          onClick={() => nextPage !== null && onGo(nextPage)}
          className={cn(
            READER_ICON_BUTTON,
            "bg-ds-accent text-ds-on-accent hover:bg-ds-accent-ink hover:text-ds-on-accent",
          )}
        >
          <ChevronRight className="size-5" aria-hidden />
        </button>
      </div>
    </nav>
  );
}
