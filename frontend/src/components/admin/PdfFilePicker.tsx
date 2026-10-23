"use client";

import { useId, useRef } from "react";
import { FileText, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { pdfFileProblem, type PdfFileProblem } from "@/lib/admin/pdf-file";
import { formatBytes } from "@/lib/utils/bytes";
import type { PdfUploadState } from "./usePdfUpload";

/** Shundan katta fayl uchun "oynani yopmang" eslatmasi ko'rsatiladi. */
const LARGE_FILE_BYTES = 200 * 1024 * 1024;

export interface PdfFilePickerProps {
  label: string;
  file: File | null;
  onChange: (file: File | null, problem: PdfFileProblem | null) => void;
  /** Tanlangan faylning muammosi (`admin.pdfUpload.problems.*`). */
  problem?: PdfFileProblem | null;
  upload?: PdfUploadState;
  disabled?: boolean;
  /** Mavjud fayl bo'lsa tugma "Almashtirish" deydi. */
  hasExisting?: boolean;
  /** Berilsa, yuklash vaqtida "Bekor qilish" tugmasi ko'rinadi. */
  onCancel?: () => void;
}

/** PDF tanlash va yuklash holati: tanlangan fayl, progress, bosqich (yuklash → muqova). */
export function PdfFilePicker({
  label,
  file,
  onChange,
  problem,
  upload,
  disabled,
  hasExisting,
  onCancel,
}: PdfFilePickerProps) {
  const t = useTranslations("admin.pdfUpload");
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const busy = upload?.phase === "uploading" || upload?.phase === "cover";

  return (
    <div className="flex flex-col gap-2">
      <span id={`${id}-label`} className="text-foreground text-sm font-medium">
        {label}
      </span>
      <div className="border-border bg-surface flex flex-wrap items-center gap-3 rounded-lg border border-dashed p-3">
        <span className="bg-subtle text-muted flex size-10 items-center justify-center rounded">
          <FileText className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          {file ? (
            <p className="truncate text-sm" data-testid="pdf-selected">
              {file.name} · {formatBytes(file.size)}
            </p>
          ) : (
            <p className="text-muted text-sm">{t("none")}</p>
          )}
          <p className="text-muted text-xs">{t("hint")}</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          aria-labelledby={`${id}-label`}
          data-testid="pdf-input"
          className="sr-only"
          disabled={disabled || busy}
          onChange={(event) => {
            const chosen = event.target.files?.[0] ?? null;
            onChange(chosen, chosen ? pdfFileProblem(chosen) : null);
            event.target.value = "";
          }}
        />
        <Button
          variant="secondary"
          size="sm"
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="size-4" aria-hidden />
          {file || hasExisting ? t("replace") : t("choose")}
        </Button>
      </div>

      {problem && (
        <p role="alert" className="text-danger text-sm">
          {t(`problems.${problem}`)}
        </p>
      )}

      {busy && (
        <div role="status" className="flex flex-col gap-1.5" data-testid="pdf-upload-status">
          <p className="text-muted text-sm">
            {upload.phase === "uploading" ? t("phases.uploading") : t("phases.cover")}
          </p>
          <ProgressBar
            value={Math.round((upload.phase === "uploading" ? upload.progress : 1) * 100)}
            label={t("progress")}
            showValue
          />
          {upload.phase === "uploading" && file && (
            <p className="text-muted text-xs" data-testid="pdf-upload-bytes">
              {t("bytes", {
                loaded: formatBytes(Math.round(upload.progress * file.size)),
                total: formatBytes(file.size),
              })}
              {file.size >= LARGE_FILE_BYTES && ` · ${t("largeHint")}`}
            </p>
          )}
          {upload.phase === "uploading" && onCancel && (
            <div>
              <Button variant="secondary" size="sm" onClick={onCancel}>
                {t("cancel")}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
