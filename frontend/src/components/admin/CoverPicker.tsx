"use client";

import { useEffect, useId, useMemo, useRef } from "react";
import { ImageUp } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { coverImageProblem, type CoverChoice, type CoverMode } from "@/lib/admin/cover";
import { cn } from "@/lib/utils/cn";

const MODES: CoverMode[] = ["auto", "first_page", "custom"];

export interface CoverPickerProps {
  value: CoverChoice;
  onChange: (value: CoverChoice) => void;
  disabled?: boolean;
  /** PDF yo'q bo'lsa "birinchi bet" tanlab bo'lmaydi. */
  firstPageUnavailable?: boolean;
}

/** Muqova tanlovi: avtomatik (generativ), PDF 1-beti yoki o'z rasmi (JPG/PNG/WebP). */
export function CoverPicker({ value, onChange, disabled, firstPageUnavailable }: CoverPickerProps) {
  const t = useTranslations("admin.cover");
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const problem = value.image ? coverImageProblem(value.image) : null;
  const preview = useMemo(
    () => (value.image && !problem ? URL.createObjectURL(value.image) : null),
    [value.image, problem],
  );
  useEffect(() => () => (preview ? URL.revokeObjectURL(preview) : undefined), [preview]);

  return (
    <fieldset className="flex flex-col gap-3" disabled={disabled} data-testid="cover-picker">
      <legend className="text-foreground text-sm font-medium">{t("label")}</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {MODES.map((mode) => {
          const off = mode === "first_page" && firstPageUnavailable;
          return (
            <label
              key={mode}
              className={cn(
                "border-border bg-surface flex cursor-pointer flex-col gap-1 rounded-lg border p-3 text-sm",
                "has-[:checked]:border-primary-600 has-[:checked]:bg-primary-soft",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2",
                off && "cursor-not-allowed opacity-50",
              )}
            >
              <span className="flex items-center gap-2 font-medium">
                <input
                  type="radio"
                  name={`${id}-mode`}
                  value={mode}
                  checked={value.mode === mode}
                  disabled={off}
                  onChange={() => onChange({ mode, image: mode === "custom" ? value.image : null })}
                />
                {t(`modes.${mode}.title`)}
              </span>
              <span className="text-muted">{t(`modes.${mode}.hint`)}</span>
            </label>
          );
        })}
      </div>
      {value.mode === "custom" && (
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={inputRef}
            id={`${id}-file`}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            data-testid="cover-file"
            onChange={(event) =>
              onChange({ mode: "custom", image: event.target.files?.[0] ?? null })
            }
          />
          <Button variant="ghost" onClick={() => inputRef.current?.click()}>
            <ImageUp className="size-4" aria-hidden />
            {t(value.image ? "replaceImage" : "chooseImage")}
          </Button>
          {value.image && <span className="text-muted truncate text-sm">{value.image.name}</span>}
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element -- lokal blob oldindan ko'rish
            <img src={preview} alt={t("previewAlt")} className="h-20 w-auto rounded border" />
          )}
          {problem && (
            <p role="alert" className="text-danger w-full text-sm">
              {t(`problems.${problem}`)}
            </p>
          )}
          <p className="text-muted w-full text-xs">{t("imageHint")}</p>
        </div>
      )}
    </fieldset>
  );
}
