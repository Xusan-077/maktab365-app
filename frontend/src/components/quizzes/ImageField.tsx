"use client";

import { useId, useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { getQuizzesApi } from "@/lib/quizzes/api";

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

export interface ImageValue {
  path: string;
  url: string | null;
}

interface Props {
  label: string;
  value: ImageValue;
  onChange: (value: ImageValue) => void;
}

/** Rasm yuklash (muqova yoki savol rasmi): fayl darrov yuklanadi, formaga faqat `path` yoziladi. */
export function ImageField({ label, value, onChange }: Props) {
  const t = useTranslations("quizzes.form.image");
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) return setError(t("errors.type"));
    if (file.size > MAX_BYTES) return setError(t("errors.size"));
    setError(null);
    setBusy(true);
    try {
      const uploaded = await getQuizzesApi().uploadImage(file);
      onChange({ path: uploaded.path, url: uploaded.url });
    } catch {
      setError(t("errors.upload"));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex flex-wrap items-center gap-3">
        {value.url && (
          // eslint-disable-next-line @next/next/no-img-element -- yuklangan rasmning ommaviy manzili
          <img src={value.url} alt="" className="border-border h-20 w-auto rounded-lg border" />
        )}
        <input
          ref={input}
          id={inputId}
          type="file"
          accept={ACCEPTED.join(",")}
          className="sr-only"
          onChange={(event) => pick(event.target.files?.[0])}
        />
        <Button
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <ImagePlus className="size-4" aria-hidden />
          )}
          {value.path ? t("replace") : t("add")}
        </Button>
        {value.path && !busy && (
          <Button variant="ghost" size="sm" onClick={() => onChange({ path: "", url: null })}>
            <X className="size-4" aria-hidden />
            {t("remove")}
          </Button>
        )}
      </div>
      {error ? (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      ) : (
        <p className="text-muted text-xs">{t("hint")}</p>
      )}
    </div>
  );
}
