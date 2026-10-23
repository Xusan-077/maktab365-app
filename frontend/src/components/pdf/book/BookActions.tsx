"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpen, Check, Download, Link2, Send, Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, buttonVariants } from "@/components/ui/Button";
import { ApiError } from "@/lib/api/types";
import { Link } from "@/lib/i18n/navigation";
import { resolveFileUrl } from "@/lib/pdf/file-url";
import { getPdfBooksApi } from "@/lib/pdf-books/api";
import { formatBytes } from "@/lib/utils/bytes";
import { readerPath } from "@/lib/utils/routes";

export interface BookActionsProps {
  id: string;
  grade: number;
  slug: string;
  title: string;
  sizeBytes: number;
  allowDownload: boolean;
}

/** `https://t.me/share/url` havolasi (Telegram'da ulashish). */
export function telegramShareUrl(url: string, text: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
}

/** Brauzerga fayl saqlashni topshiradi (imzolangan URL `attachment` sarlavhasi bilan keladi). */
function startDownload(url: string, filename: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
}

function ShareMenu({ title, grade }: { title: string; grade: number }) {
  const t = useTranslations("pdfBooks.page");
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const url = () => `${window.location.origin}${window.location.pathname}`;
  const text = t("shareText", { title, grade });
  const item =
    "hover:bg-subtle flex min-h-11 w-full items-center gap-2 rounded-md px-3 text-left text-sm";

  return (
    <div ref={root} className="relative">
      <Button
        variant="secondary"
        size="lg"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Share2 className="size-4" aria-hidden />
        {t("share")}
      </Button>
      {open && (
        <div
          role="menu"
          className="border-border bg-surface absolute top-full left-0 z-30 mt-2 w-64 rounded-xl border p-1 shadow-lg"
        >
          <a
            role="menuitem"
            href={telegramShareUrl(url(), text)}
            target="_blank"
            rel="noopener noreferrer"
            className={item}
            onClick={() => setOpen(false)}
          >
            <Send className="size-4" aria-hidden />
            {t("shareTelegram")}
          </a>
          <button
            type="button"
            role="menuitem"
            className={item}
            onClick={() => {
              void navigator.clipboard?.writeText(url()).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              });
            }}
          >
            {copied ? (
              <Check className="text-success size-4" aria-hidden />
            ) : (
              <Link2 className="size-4" aria-hidden />
            )}
            <span aria-live="polite">{copied ? t("copied") : t("copyLink")}</span>
          </button>
          {canNativeShare && (
            <button
              type="button"
              role="menuitem"
              className={item}
              onClick={() => {
                setOpen(false);
                void navigator.share({ title, text, url: url() }).catch(() => undefined);
              }}
            >
              <Share2 className="size-4" aria-hidden />
              {t("shareMore")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Kitob sahifasining asosiy harakatlari: onlayn o'qish (asosiy), PDF yuklab olish, ulashish. */
export function BookActions({
  id,
  grade,
  slug,
  title,
  sizeBytes,
  allowDownload,
}: BookActionsProps) {
  const t = useTranslations("pdfBooks.page");
  const [state, setState] = useState<"idle" | "loading" | "failed" | "disabled">("idle");

  const download = async () => {
    setState("loading");
    try {
      const file = await getPdfBooksApi().download(id);
      startDownload(resolveFileUrl(file.url, window.location.origin), file.filename);
      setState("idle");
    } catch (error) {
      const disabled = error instanceof ApiError && error.code === "download_disabled";
      setState(disabled ? "disabled" : "failed");
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Link href={readerPath({ grade, slug })} className={buttonVariants({ size: "lg" })}>
          <BookOpen className="size-5" aria-hidden />
          {t("read")}
        </Link>
        {allowDownload && (
          <Button
            variant="secondary"
            size="lg"
            loading={state === "loading"}
            onClick={() => void download()}
          >
            {state !== "loading" && <Download className="size-4" aria-hidden />}
            {state === "loading"
              ? t("downloading")
              : sizeBytes > 0
                ? t("downloadSize", { size: formatBytes(sizeBytes) })
                : t("download")}
          </Button>
        )}
        <ShareMenu title={title} grade={grade} />
      </div>
      {(!allowDownload || state === "disabled") && (
        <p className="text-muted text-sm" role="status">
          {t("downloadDisabled")}
        </p>
      )}
      {state === "failed" && (
        <p className="text-danger text-sm" role="alert">
          {t("downloadFailed")}
        </p>
      )}
    </div>
  );
}
