"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { BookOpen, Check, Link2, Send, Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useBookResume } from "@/hooks/useBookResume";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils/cn";
import { readerPath } from "@/lib/utils/routes";

export interface BookActionsProps {
  id: string;
  grade: number;
  slug: string;
  title: string;
  pageCount: number;
  /** "Saqlash" kabi qo'shimcha tugmalar (ulashishdan oldin). */
  children?: ReactNode;
}

const outlineButton =
  "border-input-border bg-surface text-foreground hover:bg-surface-2 flex items-center justify-center rounded-2xl border-[1.5px] font-semibold transition-colors disabled:opacity-50";

/** `https://t.me/share/url` havolasi (Telegram'da ulashish). */
export function telegramShareUrl(url: string, text: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
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
      <button
        type="button"
        aria-label={t("share")}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={cn(outlineButton, "size-14")}
      >
        <Share2 className="size-5" aria-hidden />
      </button>
      {open && (
        <div
          role="menu"
          className="border-border bg-surface absolute top-full right-0 z-30 mt-2 w-64 rounded-xl border p-1 shadow-lg sm:right-auto sm:left-0"
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

const readLink =
  "bg-brand hover:bg-brand-hover flex h-14 items-center gap-2.5 rounded-2xl px-7 text-[1.0625rem] font-bold text-white transition-colors";

/** Progress/saqlash ma'lumoti kelguncha (Suspense fallback, serverda chiziladi): oddiy "Onlayn o'qish". */
export function BookActionsFallback({ grade, slug }: Pick<BookActionsProps, "grade" | "slug">) {
  const t = useTranslations("pdfBooks.page");
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <Link href={readerPath({ grade, slug })} className={readLink}>
        <BookOpen className="size-5" aria-hidden />
        {t("read")}
      </Link>
    </div>
  );
}

/** Kitob sahifasining harakatlari: o'qish yoki davom ettirish (asosiy), saqlash, ulashish (yuklab olish yo'q). */
export function BookActions({ id, grade, slug, title, pageCount, children }: BookActionsProps) {
  const t = useTranslations("pdfBooks.page");
  const { resumePage } = useBookResume(id, pageCount);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <Link href={readerPath({ grade, slug }, resumePage)} className={readLink}>
          <BookOpen className="size-5" aria-hidden />
          {resumePage ? t("resume", { page: resumePage }) : t("read")}
        </Link>
        {children}
        <ShareMenu title={title} grade={grade} />
      </div>
    </div>
  );
}
