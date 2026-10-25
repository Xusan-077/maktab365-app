"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Dialog } from "@/components/ui/Dialog";
import { Popover } from "@/components/ui/Popover";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Switch } from "@/components/ui/Switch";
import type { ReaderFit, ReaderTone } from "@/lib/pdf/reader-prefs";
import type { ReadingMode } from "@/lib/pdf/reading-mode";
import { DEFAULT_ZOOM, formatZoom, MAX_ZOOM, MIN_ZOOM, nudgeZoom } from "@/lib/pdf/zoom";
import { cn } from "@/lib/utils/cn";
import { READER_ICON_BUTTON } from "./reader-styles";

export interface AppearanceSettingsProps {
  tone: ReaderTone;
  mode: ReadingMode;
  fit: ReaderFit;
  zoom: number;
  warm: boolean;
  onTone: (tone: ReaderTone) => void;
  onMode: (mode: ReadingMode) => void;
  onFit: (fit: ReaderFit) => void;
  onZoom: (zoom: number) => void;
  onWarm: (warm: boolean) => void;
}

/** Fon namunasi (sahifa rangi): ko'rinishi `.reader-swatch[data-tone]` (globals.css). */
function Swatch({ tone }: { tone: ReaderTone }) {
  return <span aria-hidden data-tone={tone} className="reader-swatch size-5 rounded-full border" />;
}

const ZOOM_BUTTON =
  "border-ds-line text-ds-ink hover:bg-ds-canvas inline-flex size-11 items-center justify-center rounded-ds-sm border disabled:pointer-events-none disabled:opacity-40";

/** Aa sozlamalari: fon, masshtab (zoom — kitob ostidagi guruh bilan bitta holat), rejim, iliq rang. */
export function AppearanceSettings(props: AppearanceSettingsProps) {
  const t = useTranslations("pdfBooks.appearance");
  const scroll = props.mode === "v";
  return (
    <div className="flex flex-col gap-5" data-testid="reader-appearance">
      <SegmentedControl
        legend={t("tone")}
        value={props.tone}
        onChange={props.onTone}
        options={(["light", "sepia", "dark"] as const).map((tone) => ({
          value: tone,
          label: t(`tones.${tone}`),
          icon: <Swatch tone={tone} />,
          testId: `reader-tone-${tone}`,
        }))}
      />

      <div className="flex flex-col gap-3">
        <SegmentedControl
          legend={t("scale")}
          value={props.fit}
          onChange={props.onFit}
          options={[
            { value: "width", label: t("fitWidth"), disabled: !scroll, testId: "reader-fit-width" },
            { value: "page", label: t("fitPage"), disabled: !scroll, testId: "reader-fit-page" },
          ]}
        />
        {!scroll && <p className="text-ds-muted -mt-1 text-xs">{t("fitFlipHint")}</p>}
        <div className="flex items-center gap-2" role="group" aria-label={t("zoom")}>
          <button
            type="button"
            className={ZOOM_BUTTON}
            aria-label={t("zoomOut")}
            disabled={props.zoom <= MIN_ZOOM}
            onClick={() => props.onZoom(nudgeZoom(props.zoom, -1))}
          >
            <Minus className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            data-testid="reader-zoom-reset"
            aria-label={t("zoomReset", { value: formatZoom(props.zoom) })}
            onClick={() => props.onZoom(DEFAULT_ZOOM)}
            title={t("fitLabel")}
            className="bg-ds-canvas text-ds-ink rounded-ds-sm h-11 flex-1 text-sm font-bold tabular-nums"
          >
            {formatZoom(props.zoom)}
          </button>
          <button
            type="button"
            className={ZOOM_BUTTON}
            aria-label={t("zoomIn")}
            disabled={props.zoom >= MAX_ZOOM}
            onClick={() => props.onZoom(nudgeZoom(props.zoom, 1))}
          >
            <Plus className="size-4" aria-hidden />
          </button>
        </div>
      </div>

      <SegmentedControl
        legend={t("paging")}
        value={props.mode}
        onChange={props.onMode}
        options={[
          { value: "b", label: t("pagingFlip"), testId: "pdf-mode-b" },
          { value: "v", label: t("pagingScroll"), testId: "pdf-mode-v" },
        ]}
      />

      <div className="border-ds-line flex flex-col gap-1 border-t pt-3">
        <Switch
          checked={props.warm}
          onCheckedChange={props.onWarm}
          label={t("warm")}
          description={t("warmHint")}
          testId="reader-warm"
        />
      </div>
    </div>
  );
}

/** «Aa» tugmasi: desktopda popover, mobilda pastki sheet. */
export function AppearanceMenu({
  desktop,
  ...settings
}: AppearanceSettingsProps & { desktop: boolean }) {
  const t = useTranslations("pdfBooks.appearance");
  const [open, setOpen] = useState(false);
  const label = (
    <span aria-hidden className="text-base leading-none font-bold">
      {t("short")}
    </span>
  );
  if (desktop) {
    return (
      <Popover
        open={open}
        onOpenChange={setOpen}
        label={t("title")}
        trigger={(props) => (
          <button
            type="button"
            {...props}
            aria-label={t("title")}
            data-testid="pdf-view-open"
            className={cn(READER_ICON_BUTTON)}
          >
            {label}
          </button>
        )}
      >
        <AppearanceSettings {...settings} />
      </Popover>
    );
  }
  return (
    <>
      <button
        type="button"
        aria-label={t("title")}
        aria-haspopup="dialog"
        data-testid="pdf-view-open"
        onClick={() => setOpen(true)}
        className={READER_ICON_BUTTON}
      >
        {label}
      </button>
      <Dialog open={open} onOpenChange={setOpen} title={t("title")} placement="bottom">
        {open && <AppearanceSettings {...settings} />}
      </Dialog>
    </>
  );
}
