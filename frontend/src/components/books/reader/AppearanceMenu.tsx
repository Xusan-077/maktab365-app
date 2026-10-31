"use client";

import { useState } from "react";
import { Minus, Palette, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Dialog } from "@/components/ui/Dialog";
import { Popover } from "@/components/ui/Popover";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import {
  BOOK_FONTS,
  BOOK_THEMES,
  LINE_HEIGHTS,
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
  type BookReaderPrefs,
} from "@/lib/books/reader";
import { useBookReaderStore } from "@/stores/book-reader.store";
import { BK_ICON_BUTTON } from "./reader-styles";

const STEP_BUTTON =
  "border-ds-line text-ds-ink hover:bg-ds-canvas inline-flex size-11 items-center justify-center rounded-lg border transition-colors disabled:pointer-events-none disabled:opacity-40";

function LookPanel({ prefs, hasText }: { prefs: BookReaderPrefs; hasText: boolean }) {
  const t = useTranslations("books.reader.look");
  const { setView, setTheme, setFont, setLineHeight, stepFont } = useBookReaderStore.getState();
  const textView = prefs.view === "text";

  return (
    <div className="flex flex-col gap-5">
      <SegmentedControl
        legend={t("view")}
        value={hasText ? prefs.view : "page"}
        onChange={setView}
        options={[
          { value: "page", label: t("viewPage") },
          { value: "text", label: t("viewText"), disabled: !hasText },
        ]}
      />
      {!hasText && <p className="text-ds-muted -mt-3 text-xs">{t("textUnavailable")}</p>}

      <SegmentedControl
        legend={t("theme")}
        value={prefs.theme}
        onChange={setTheme}
        options={BOOK_THEMES.map((theme) => ({
          value: theme,
          label: t(`theme${theme === "paper" ? "Paper" : theme === "sepia" ? "Sepia" : "Night"}`),
        }))}
      />

      <div className="flex flex-col gap-5" aria-disabled={!textView || undefined}>
        <SegmentedControl
          legend={t("font")}
          value={prefs.font}
          onChange={setFont}
          options={BOOK_FONTS.map((font) => ({
            value: font,
            label: t(font === "serif" ? "fontSerif" : "fontSans"),
          }))}
        />
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold">{t("size")}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={STEP_BUTTON}
              aria-label={t("sizeDown")}
              disabled={prefs.fontSize <= MIN_FONT_SIZE}
              onClick={() => stepFont(-1)}
            >
              <Minus className="size-4" aria-hidden />
            </button>
            <output className="w-9 text-center text-sm tabular-nums" aria-live="polite">
              {prefs.fontSize}
            </output>
            <button
              type="button"
              className={STEP_BUTTON}
              aria-label={t("sizeUp")}
              disabled={prefs.fontSize >= MAX_FONT_SIZE}
              onClick={() => stepFont(1)}
            >
              <Plus className="size-4" aria-hidden />
            </button>
          </div>
        </div>
        <SegmentedControl
          legend={t("lineHeight")}
          value={String(prefs.lineHeight)}
          onChange={(value) => setLineHeight(Number(value) as (typeof LINE_HEIGHTS)[number])}
          options={LINE_HEIGHTS.map((height) => ({ value: String(height), label: String(height) }))}
        />
        {!textView && <p className="text-ds-muted -mt-3 text-xs">{t("textOnly")}</p>}
      </div>
    </div>
  );
}

/** "Ko'rinish" tugmasi: desktopda tugma ostidagi panel, mobilda pastki sheet. */
export function AppearanceMenu({
  prefs,
  hasText,
  label,
  onOpenChange,
}: {
  prefs: BookReaderPrefs;
  hasText: boolean;
  /** Tugma nomi (tooltip bilan). */
  label: string;
  onOpenChange?: (open: boolean) => void;
}) {
  const t = useTranslations("books.reader.look");
  const [open, setOpenState] = useState(false);
  const setOpen = (value: boolean) => {
    setOpenState(value);
    onOpenChange?.(value);
  };
  const wide = useMediaQuery("(min-width: 640px)");

  const button = (props: Record<string, unknown>) => (
    <button type="button" className={BK_ICON_BUTTON} aria-label={label} title={label} {...props}>
      <Palette className="size-5" aria-hidden />
    </button>
  );

  if (wide) {
    return (
      <Popover open={open} onOpenChange={setOpen} label={t("title")} trigger={button}>
        <LookPanel prefs={prefs} hasText={hasText} />
      </Popover>
    );
  }
  return (
    <>
      {button({ "aria-expanded": open, onClick: () => setOpen(true) })}
      <Dialog open={open} onOpenChange={setOpen} title={t("title")} placement="bottom">
        <LookPanel prefs={prefs} hasText={hasText} />
      </Dialog>
    </>
  );
}
