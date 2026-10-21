"use client";

import { useId, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { FileText, ImageIcon, Trash2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { getAdminApi } from "@/lib/admin/api";
import type { UploadKind } from "@/lib/admin/types";
import { useAdminErrorText } from "./useAdminErrorText";

const ACCEPT: Record<UploadKind, string> = {
  cover: "image/jpeg,image/png,image/webp",
  image: "image/jpeg,image/png,image/webp",
  pdf: "application/pdf",
};

export interface FileUploadProps {
  kind: UploadKind;
  label: string;
  /** Saqlangan fayl yo'li (`covers/…`); bo'sh — fayl yo'q. */
  path: string;
  /** Hozirgi faylning ko'rinadigan manzili (rasm ko'rsatish / PDF havolasi uchun). */
  url?: string | null;
  onChange: (path: string, url: string | null) => void;
  disabled?: boolean;
}

/** Fayl yuklash: tanlangan fayl darhol `POST uploads/` ga ketadi, forma esa natijadagi yo'lni saqlaydi. */
export function FileUpload({ kind, label, path, url, onChange, disabled }: FileUploadProps) {
  const t = useTranslations("admin.upload");
  const errorText = useAdminErrorText();
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();

  const upload = useMutation({
    mutationFn: (file: File) => getAdminApi().upload(file, kind),
    onSuccess: (result) => onChange(result.path, result.url),
  });

  const Icon = kind === "pdf" ? FileText : ImageIcon;
  const fileName = path.split("/").pop();

  return (
    <div className="flex flex-col gap-2">
      <span id={`${id}-label`} className="text-foreground text-sm font-medium">
        {label}
      </span>
      <div className="border-border bg-surface flex flex-wrap items-center gap-3 rounded-lg border p-3">
        {kind !== "pdf" && url ? (
          // Backend manzili (tashqi domen bo'lishi mumkin): next/image sozlamasi shart emas.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="bg-subtle h-16 w-12 rounded object-cover" />
        ) : (
          <span className="bg-subtle text-muted flex size-10 items-center justify-center rounded">
            <Icon className="size-5" aria-hidden />
          </span>
        )}
        <div className="min-w-0 flex-1">
          {path ? (
            <p className="truncate text-sm">
              {kind === "pdf" && url ? (
                <a href={url} target="_blank" rel="noreferrer" className="text-link underline">
                  {fileName}
                </a>
              ) : (
                fileName
              )}
            </p>
          ) : (
            <p className="text-muted text-sm">{t("none")}</p>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT[kind]}
          aria-labelledby={`${id}-label`}
          data-testid={`upload-${kind}`}
          className="sr-only"
          disabled={disabled || upload.isPending}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) upload.mutate(file);
            event.target.value = "";
          }}
        />
        <Button
          variant="secondary"
          size="sm"
          loading={upload.isPending}
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="size-4" aria-hidden />
          {path ? t("replace") : t("choose")}
        </Button>
        {path && (
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled || upload.isPending}
            onClick={() => onChange("", null)}
          >
            <Trash2 className="size-4" aria-hidden />
            {t("remove")}
          </Button>
        )}
      </div>
      {upload.isError && (
        <p role="alert" className="text-danger text-sm">
          {errorText(upload.error)}
        </p>
      )}
    </div>
  );
}
