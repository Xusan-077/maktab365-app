"use client";

import {
  Check,
  Eraser,
  Highlighter,
  MousePointer2,
  PenLine,
  Pencil,
  Redo2,
  Sigma,
  Type,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { AnimatePresence, EASE_OUT, m } from "@/components/ui/motion";
import {
  HIGHLIGHT_COLORS,
  PEN_COLORS,
  PEN_WIDTHS,
  resolveColor,
  TEXT_SIZES,
  type AnnotationTool,
} from "@/lib/books/annotations";
import type { BookTheme } from "@/lib/books/reader";
import { cn } from "@/lib/utils/cn";
import { BK_ICON_BUTTON, withKey } from "../reader-styles";
import { ColorPicker } from "./ColorPicker";
import type { DrawSettings } from "./AnnotationCanvas";

type ActiveTool = Exclude<AnnotationTool, "none">;

const TOOLS: { tool: ActiveTool; icon: LucideIcon }[] = [
  { tool: "select", icon: MousePointer2 },
  { tool: "pen", icon: Pencil },
  { tool: "highlight", icon: Highlighter },
  { tool: "text", icon: Type },
  { tool: "eraser", icon: Eraser },
];

/** Matematika kitob: «Misol yechimi» asbobi matn va o'chirgich orasida. */
const SOLUTION_TOOL: { tool: ActiveTool; icon: LucideIcon } = { tool: "solution", icon: Sigma };
const MATH_TOOLS = [...TOOLS.slice(0, 4), SOLUTION_TOOL, ...TOOLS.slice(4)];

/** Chiziq namunasi uchun taxminiy bet eni (px): qalinlik betga nisbatan berilgan. */
const SAMPLE_PAGE_PX = 640;

export interface ToolBarProps {
  tool: AnnotationTool;
  settings: DrawSettings;
  recentColors: readonly string[];
  theme: BookTheme;
  canUndo: boolean;
  canRedo: boolean;
  /** Matematika kitob: «Misol yechimi» asbobi ko'rinadi. */
  mathMode?: boolean;
  /** Panellar yig'iq turganda «Chizish» tugmasi ko'rinmaydi; asbob tanlangan bo'lsa panel doim ko'rinadi. */
  visible: boolean;
  onToolChange: (tool: AnnotationTool) => void;
  onUndo: () => void;
  onRedo: () => void;
  onPenColor: (color: string) => void;
  onPenWidth: (width: number) => void;
  onHighlightColor: (color: string) => void;
  onTextColor: (color: string) => void;
  onTextSize: (size: number) => void;
}

const SURFACE =
  "bg-bk-bar border-bk-line text-bk-ink border shadow-[0_10px_32px_-10px_rgb(0_0_0/0.4)]";

/** Siyoh namunasi: tanlangan rang va qalinlikda to'lqinsimon chiziq — nima chizilishini oldindan ko'rsatadi. */
function InkSample({
  color,
  width,
  highlight,
}: {
  color: string;
  width: number;
  highlight?: boolean;
}) {
  const stroke = highlight ? 14 : Math.max(1.5, width * SAMPLE_PAGE_PX);
  return (
    <svg
      viewBox="0 0 64 24"
      className="h-6 w-16 shrink-0"
      role="presentation"
      aria-hidden
      data-ink-sample
    >
      <path
        d="M4 14 C 14 2, 22 2, 32 12 S 50 22, 60 8"
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap={highlight ? "butt" : "round"}
        strokeOpacity={highlight ? 0.55 : 1}
      />
    </svg>
  );
}

/** Qalinlik/o'lcham: har qadam o'z o'lchamida (`radiogroup`); tanlangani rangda ko'rinadi. */
function StepPicker({
  label,
  values,
  value,
  color,
  onChange,
  describe,
  letters,
}: {
  label: string;
  values: readonly number[];
  value: number;
  color: string;
  onChange: (value: number) => void;
  describe: (index: number) => string;
  letters?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex items-center">
      {values.map((item, index) => {
        const selected = item === value;
        return (
          <button
            key={item}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={describe(index)}
            title={describe(index)}
            onClick={() => onChange(item)}
            className={cn(
              "inline-flex size-11 items-center justify-center rounded-xl transition-colors sm:size-10",
              selected ? "bg-bk-accent-soft" : "hover:bg-bk-accent-soft/60",
            )}
          >
            {letters ? (
              <span
                className="leading-none font-semibold"
                style={{ fontSize: 12 + index * 5, color: selected ? color : undefined }}
                aria-hidden
              >
                A
              </span>
            ) : (
              <span
                className="rounded-full"
                style={{
                  width: 5 + index * 4,
                  height: 5 + index * 4,
                  backgroundColor: selected ? color : "currentColor",
                  opacity: selected ? 1 : 0.55,
                }}
                aria-hidden
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Chizish «qalamdoni»: ekran pastida markazda. Asbob tanlanmaguncha bitta «Chizish» tugmasi; tanlangach
 * asboblar qatori ochiladi — tanlangani yuqoriga ko'tarilib, uchida joriy siyoh rangini ko'rsatadi.
 * Tanlangan asbobning rangi va qalinligi qator ustida, chiziq namunasi bilan; «Tayyor» chizishni yopadi.
 */
export function ToolBar({
  tool,
  settings,
  recentColors,
  theme,
  canUndo,
  canRedo,
  mathMode = false,
  visible,
  onToolChange,
  onUndo,
  onRedo,
  onPenColor,
  onPenWidth,
  onHighlightColor,
  onTextColor,
  onTextSize,
}: ToolBarProps) {
  const t = useTranslations("books.workspace");
  const keys = useTranslations("books.workspace.keys");
  const active = tool !== "none";

  const label = (value: ActiveTool) => t(`tools.${value}`);
  const inkOf = (color: string) => resolveColor(color, theme);
  /** Asbob uchidagi rang: faqat rangli asboblarda. */
  const tipColor = (value: ActiveTool): string | null => {
    if (value === "pen") return inkOf(settings.penColor);
    if (value === "highlight") return inkOf(settings.highlightColor);
    if (value === "text") return inkOf(settings.textColor);
    return null;
  };

  const options = (() => {
    switch (tool) {
      case "pen":
        return (
          <>
            <InkSample color={inkOf(settings.penColor)} width={settings.penWidth} />
            <ColorPicker
              label={t("color")}
              colors={PEN_COLORS}
              value={settings.penColor}
              theme={theme}
              recent={recentColors}
              onChange={onPenColor}
            />
            <StepPicker
              label={t("width")}
              values={PEN_WIDTHS}
              value={settings.penWidth}
              color={inkOf(settings.penColor)}
              onChange={onPenWidth}
              describe={(index) => t(`widths.${index}`)}
            />
          </>
        );
      case "highlight":
        return (
          <>
            <InkSample color={inkOf(settings.highlightColor)} width={0} highlight />
            <ColorPicker
              label={t("color")}
              colors={HIGHLIGHT_COLORS}
              value={settings.highlightColor}
              theme={theme}
              onChange={onHighlightColor}
            />
          </>
        );
      case "text":
        return (
          <>
            <ColorPicker
              label={t("color")}
              colors={PEN_COLORS}
              value={settings.textColor}
              theme={theme}
              recent={recentColors}
              onChange={onTextColor}
            />
            <StepPicker
              label={t("textSize")}
              values={TEXT_SIZES}
              value={settings.textSize}
              color={inkOf(settings.textColor)}
              onChange={onTextSize}
              describe={(index) => t(`textSizes.${index}`)}
              letters
            />
          </>
        );
      default:
        return null;
    }
  })();

  return (
    <div
      data-workspace-toolbar
      data-active={active || undefined}
      className={cn(
        "pointer-events-none absolute inset-x-0 bottom-[4.5rem] z-30 flex justify-center px-2",
        "transition-[opacity,translate] duration-250 ease-out",
        !visible && !active && "translate-y-3 opacity-0",
      )}
    >
      <div
        className={cn(
          "relative flex max-w-full flex-col items-center gap-2",
          (visible || active) && "pointer-events-auto",
        )}
      >
        <AnimatePresence initial={false}>
          {options && (
            <m.div
              key={tool}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.18, ease: EASE_OUT }}
              className={cn(
                SURFACE,
                "flex max-w-full flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-2xl py-1.5 pr-2 pl-3.5",
              )}
              data-tool-options={tool}
            >
              {options}
            </m.div>
          )}
        </AnimatePresence>

        <AnimatePresence initial={false} mode="wait">
          {!active ? (
            <m.button
              key="open"
              type="button"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ duration: 0.18, ease: EASE_OUT }}
              onClick={() => onToolChange("pen")}
              aria-label={t("open")}
              title={withKey(t("open"), keys("pen"))}
              className={cn(
                SURFACE,
                "hover:bg-bk-accent-soft inline-flex h-12 items-center gap-2.5 rounded-full pr-5 pl-4 text-[0.9375rem] font-medium transition-colors",
              )}
            >
              <PenLine className="size-5" aria-hidden />
              {t("open")}
            </m.button>
          ) : (
            <m.div
              key="tools"
              role="toolbar"
              aria-label={t("toolbar")}
              aria-orientation="horizontal"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
              className={cn(
                SURFACE,
                "flex max-w-full [scrollbar-width:none] items-end gap-0.5 overflow-x-auto rounded-2xl px-1.5 pt-2 pb-1.5",
              )}
            >
              {(mathMode ? MATH_TOOLS : TOOLS).map(({ tool: item, icon: Icon }) => {
                const selected = tool === item;
                const tip = tipColor(item);
                return (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={selected}
                    aria-label={label(item)}
                    title={withKey(label(item), keys(item))}
                    data-tool-button={item}
                    onClick={() => onToolChange(item)}
                    className={cn(
                      "group relative flex h-12 min-w-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded-xl px-2 transition-[background-color,translate] duration-200 ease-out",
                      selected
                        ? "bg-bk-accent-soft text-bk-accent -translate-y-1"
                        : "text-bk-ink hover:bg-bk-accent-soft/60",
                    )}
                  >
                    <Icon className="size-5" aria-hidden />
                    {selected ? (
                      <span className="text-[0.6875rem] leading-none font-medium">
                        {label(item)}
                      </span>
                    ) : null}
                    {tip && (
                      <span
                        aria-hidden
                        className={cn(
                          "absolute bottom-1 h-[3px] rounded-full transition-[width,opacity]",
                          selected ? "w-5 opacity-0" : "w-4 opacity-100",
                        )}
                        style={{ backgroundColor: tip }}
                      />
                    )}
                  </button>
                );
              })}
              <span className="bg-bk-line mx-1 mb-2.5 h-6 w-px shrink-0" aria-hidden />
              <button
                type="button"
                className={cn(BK_ICON_BUTTON, "mb-0.5")}
                disabled={!canUndo}
                onClick={onUndo}
                aria-label={t("undo")}
                title={withKey(t("undo"), keys("undo"))}
              >
                <Undo2 className="size-5" aria-hidden />
              </button>
              <button
                type="button"
                className={cn(BK_ICON_BUTTON, "mb-0.5")}
                disabled={!canRedo}
                onClick={onRedo}
                aria-label={t("redo")}
                title={withKey(t("redo"), keys("redo"))}
              >
                <Redo2 className="size-5" aria-hidden />
              </button>
              <span className="bg-bk-line mx-1 mb-2.5 h-6 w-px shrink-0" aria-hidden />
              <button
                type="button"
                onClick={() => onToolChange("none")}
                aria-label={t("done")}
                title={withKey(t("done"), keys("close"))}
                className="bg-bk-accent text-bk-paper mb-0.5 inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl px-3.5 text-sm font-semibold transition-opacity hover:opacity-90"
              >
                <Check className="size-4" aria-hidden />
                {t("done")}
              </button>
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
