"use client";

import { Eraser, Highlighter, Pen, Redo2, Smartphone, Trash2, Undo2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { colorLabelKey, resolveColor } from "@/lib/books/annotations";
import type { BookTheme } from "@/lib/books/reader";
import { cn } from "@/lib/utils/cn";
import { READER_ICON_BUTTON } from "../reader/reader-styles";
import type { DrawTool } from "./DrawLayer";

export interface DrawToolbarProps {
  tool: Exclude<DrawTool, "none">;
  colors: readonly string[];
  color: string;
  /** 3 ta qalinlik indeksi (0 — ingichka). */
  widthIndex: number;
  theme: BookTheme;
  canUndo: boolean;
  canRedo: boolean;
  /** Joriy betda chizma bor — «Betni tozalash» faol. */
  canClear: boolean;
  onTool: (tool: Exclude<DrawTool, "none">) => void;
  onColor: (color: string) => void;
  onWidth: (index: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onClearPage: () => void;
  onClose: () => void;
}

const TOOLS = [
  { id: "pen", icon: Pen },
  { id: "marker", icon: Highlighter },
  { id: "eraser", icon: Eraser },
] as const;

/** Qalinlik namunasi (nuqta diametri, px). */
const WIDTH_DOTS = [4, 8, 13];

/** Chizmalar faqat shu qurilmada saqlanadi (serverga yuborilmaydi). */
function LocalNotice() {
  const t = useTranslations("pdfBooks.draw.status");
  return (
    <span
      role="status"
      data-testid="draw-save-status"
      data-state="local"
      title={t("local")}
      className="text-ds-muted flex min-w-0 items-center gap-1.5 text-xs"
    >
      <Smartphone className="size-3.5 shrink-0" aria-hidden />
      <span className="truncate max-sm:sr-only">{t("local")}</span>
    </span>
  );
}

/**
 * Chizish rejimining pastki paneli (suzuvchi navigatsiya o'rnida): qalam, marker, o'chirgich,
 * undo/redo, betni tozalash, 6 ta rang, 3 ta qalinlik va «faqat shu qurilmada» belgisi. Telefonda ikki qator, kengda bitta.
 */
export function DrawToolbar(props: DrawToolbarProps) {
  const t = useTranslations("pdfBooks.draw");
  const { tool, colors, color, widthIndex, theme, canUndo, canRedo } = props;
  const strokeTool = tool !== "eraser";

  return (
    <div
      role="toolbar"
      aria-label={t("toolbar")}
      data-testid="draw-toolbar"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] print:hidden"
    >
      <div className="border-ds-line bg-ds-surface/95 text-ds-ink rounded-ds-lg pointer-events-auto flex w-full max-w-3xl flex-wrap items-center gap-x-1 gap-y-1 border p-1.5 shadow-lg backdrop-blur">
        <div className="flex items-center gap-0.5">
          {TOOLS.map(({ id, icon: Icon }) => (
            <button
              key={id}
              type="button"
              aria-label={t(id)}
              title={t(id)}
              aria-pressed={tool === id}
              data-testid={`draw-tool-${id}`}
              onClick={() => props.onTool(id)}
              className={READER_ICON_BUTTON}
            >
              <Icon className="size-5" aria-hidden />
            </button>
          ))}
          <span aria-hidden className="bg-ds-line mx-1 h-6 w-px" />
          <button
            type="button"
            aria-label={t("undo")}
            title={t("undo")}
            aria-keyshortcuts="Control+Z"
            disabled={!canUndo}
            data-testid="draw-undo"
            onClick={props.onUndo}
            className={READER_ICON_BUTTON}
          >
            <Undo2 className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            aria-label={t("redo")}
            title={t("redo")}
            aria-keyshortcuts="Control+Shift+Z"
            disabled={!canRedo}
            data-testid="draw-redo"
            onClick={props.onRedo}
            className={READER_ICON_BUTTON}
          >
            <Redo2 className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            aria-label={t("clearPage")}
            title={t("clearPage")}
            disabled={!props.canClear}
            data-testid="draw-clear-page"
            onClick={props.onClearPage}
            className={READER_ICON_BUTTON}
          >
            <Trash2 className="size-5" aria-hidden />
          </button>
        </div>

        <div className="order-last flex w-full items-center gap-1 sm:order-none sm:w-auto sm:flex-1">
          <div
            role="radiogroup"
            aria-label={t("color")}
            className={cn(
              "flex items-center gap-1",
              !strokeTool && "pointer-events-none opacity-40",
            )}
          >
            {colors.map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={color === value}
                aria-label={t(`colors.${colorLabelKey(value)}`)}
                title={t(`colors.${colorLabelKey(value)}`)}
                disabled={!strokeTool}
                data-testid="draw-color"
                onClick={() => props.onColor(value)}
                className="focus-visible:outline-ds-accent grid size-9 shrink-0 place-items-center rounded-full"
              >
                <span
                  aria-hidden
                  className={cn(
                    "size-6 rounded-full border border-black/15",
                    color === value &&
                      "ring-ds-accent ring-2 ring-offset-2 ring-offset-[var(--color-ds-surface)]",
                  )}
                  style={{ background: resolveColor(value, theme) }}
                />
              </button>
            ))}
          </div>
          <span aria-hidden className="bg-ds-line mx-1 h-6 w-px" />
          <div
            role="radiogroup"
            aria-label={t("width")}
            className={cn(
              "flex items-center gap-0.5",
              !strokeTool && "pointer-events-none opacity-40",
            )}
          >
            {WIDTH_DOTS.map((dot, index) => (
              <button
                key={dot}
                type="button"
                role="radio"
                aria-checked={widthIndex === index}
                aria-label={t(`widths.${index}`)}
                title={t(`widths.${index}`)}
                disabled={!strokeTool}
                data-testid="draw-width"
                onClick={() => props.onWidth(index)}
                className={cn(
                  READER_ICON_BUTTON,
                  "size-9",
                  widthIndex === index && "bg-ds-accent-tint text-ds-accent-ink",
                )}
              >
                <span
                  aria-hidden
                  className="rounded-full bg-current"
                  style={{ width: dot, height: dot }}
                />
              </button>
            ))}
          </div>
        </div>

        <div className="ml-auto flex min-w-0 items-center gap-1">
          <LocalNotice />
          <button
            type="button"
            aria-label={t("close")}
            title={t("close")}
            aria-keyshortcuts="Escape"
            data-testid="draw-close"
            onClick={props.onClose}
            className={READER_ICON_BUTTON}
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
