"use client";

import {
  Eraser,
  Highlighter,
  MousePointer2,
  PenLine,
  Pencil,
  Redo2,
  Sigma,
  Type,
  Undo2,
  X,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { AnimatePresence, EASE_OUT, m } from "@/components/ui/motion";
import {
  HIGHLIGHT_COLORS,
  PEN_COLORS,
  PEN_WIDTHS,
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

export interface ToolBarProps {
  tool: AnnotationTool;
  settings: DrawSettings;
  recentColors: readonly string[];
  theme: BookTheme;
  canUndo: boolean;
  canRedo: boolean;
  /** Matematika kitob: «Misol yechimi» asbobi ko'rinadi. */
  mathMode?: boolean;
  /** Asboblar yig'iq turganda (panellar yashirilganda) ko'rinmaydi; asbob tanlangan bo'lsa doim ko'rinadi. */
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

const PILL =
  "bg-bk-bar/95 border-bk-line text-bk-ink rounded-2xl border shadow-[0_8px_30px_-8px_rgb(0_0_0/0.35)] backdrop-blur";

/** O'lcham tanlash (3 ta nuqta/«A» harfi): `radiogroup`. */
function SizePicker({
  label,
  values,
  value,
  onChange,
  describe,
  letters,
}: {
  label: string;
  values: readonly number[];
  value: number;
  onChange: (value: number) => void;
  describe: (index: number) => string;
  letters?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex items-center gap-1">
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
              "inline-flex size-11 items-center justify-center rounded-lg transition-colors sm:size-9",
              selected ? "bg-bk-accent-soft text-bk-accent" : "hover:bg-bk-accent-soft",
            )}
          >
            {letters ? (
              <span className="font-semibold" style={{ fontSize: 11 + index * 4 }} aria-hidden>
                A
              </span>
            ) : (
              <span
                className="rounded-full bg-current"
                style={{ width: 4 + index * 3, height: 4 + index * 3 }}
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
 * Chizish asboblari: asbob tanlanmaguncha bitta «Chizish» tugmasi; tanlangach ixcham ustun (desktop,
 * chapda) yoki satr (mobil, pastki panel ustida) ochiladi. Tanlangan asbobning rangi/qalinligi alohida qatorda.
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

  const options = (() => {
    switch (tool) {
      case "pen":
        return (
          <>
            <ColorPicker
              label={t("color")}
              colors={PEN_COLORS}
              value={settings.penColor}
              theme={theme}
              recent={recentColors}
              onChange={onPenColor}
            />
            <SizePicker
              label={t("width")}
              values={PEN_WIDTHS}
              value={settings.penWidth}
              onChange={onPenWidth}
              describe={(index) => t(`widths.${index}`)}
            />
          </>
        );
      case "highlight":
        return (
          <ColorPicker
            label={t("color")}
            colors={HIGHLIGHT_COLORS}
            value={settings.highlightColor}
            theme={theme}
            onChange={onHighlightColor}
          />
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
            <SizePicker
              label={t("textSize")}
              values={TEXT_SIZES}
              value={settings.textSize}
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
        "pointer-events-none absolute z-30 flex transition-[opacity,translate] duration-250 ease-out",
        "inset-x-0 bottom-[4.5rem] justify-center px-1",
        "lg:inset-x-auto lg:top-1/2 lg:bottom-auto lg:left-3 lg:-translate-y-1/2 lg:px-0",
        !visible &&
          !active &&
          "pointer-events-none translate-y-3 opacity-0 lg:translate-x-[-0.75rem] lg:translate-y-[-50%]",
      )}
    >
      <div
        className={cn(
          "relative flex max-w-full items-center lg:flex-col",
          (visible || active) && "pointer-events-auto",
        )}
      >
        <AnimatePresence initial={false} mode="wait">
          {!active ? (
            <m.button
              key="open"
              type="button"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
              onClick={() => onToolChange("pen")}
              aria-label={t("open")}
              title={withKey(t("open"), keys("pen"))}
              className={cn(
                PILL,
                "hover:bg-bk-accent-soft inline-flex h-11 items-center gap-2 px-3.5 text-sm font-medium",
              )}
            >
              <PenLine className="size-5" aria-hidden />
              <span className="max-sm:sr-only lg:sr-only xl:not-sr-only">{t("open")}</span>
            </m.button>
          ) : (
            <m.div
              key="tools"
              role="toolbar"
              aria-label={t("toolbar")}
              aria-orientation="horizontal"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
              className={cn(
                PILL,
                "flex max-w-full [scrollbar-width:none] items-center gap-0 overflow-x-auto p-0.5 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:p-1",
              )}
            >
              {(mathMode ? MATH_TOOLS : TOOLS).map(({ tool: item, icon: Icon }) => (
                <button
                  key={item}
                  type="button"
                  className={BK_ICON_BUTTON}
                  aria-pressed={tool === item}
                  aria-label={label(item)}
                  title={withKey(label(item), keys(item))}
                  data-tool-button={item}
                  onClick={() => onToolChange(item)}
                >
                  <Icon className="size-5" aria-hidden />
                </button>
              ))}
              <span
                className="bg-bk-line mx-1 hidden h-6 w-px lg:mx-0 lg:my-1 lg:block lg:h-px lg:w-6"
                aria-hidden
              />
              <button
                type="button"
                className={BK_ICON_BUTTON}
                disabled={!canUndo}
                onClick={onUndo}
                aria-label={t("undo")}
                title={withKey(t("undo"), keys("undo"))}
              >
                <Undo2 className="size-5" aria-hidden />
              </button>
              <button
                type="button"
                className={BK_ICON_BUTTON}
                disabled={!canRedo}
                onClick={onRedo}
                aria-label={t("redo")}
                title={withKey(t("redo"), keys("redo"))}
              >
                <Redo2 className="size-5" aria-hidden />
              </button>
              <span
                className="bg-bk-line mx-1 hidden h-6 w-px lg:mx-0 lg:my-1 lg:block lg:h-px lg:w-6"
                aria-hidden
              />
              <button
                type="button"
                className={BK_ICON_BUTTON}
                onClick={() => onToolChange("none")}
                aria-label={t("close")}
                title={withKey(t("close"), keys("close"))}
              >
                <X className="size-5" aria-hidden />
              </button>
            </m.div>
          )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {options && (
            <m.div
              key={tool}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
              className={cn(
                PILL,
                "absolute bottom-full mb-2 flex max-w-[calc(100vw-1rem)] flex-wrap items-center justify-center gap-x-2 p-1.5",
                "lg:bottom-auto lg:left-full lg:mb-0 lg:ml-2 lg:w-max lg:max-w-60 lg:justify-start",
              )}
            >
              {options}
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
