"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { FileDown, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Popover } from "@/components/ui/Popover";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import type { PageNote } from "@/lib/books/api";
import { downloadBlob, pageFileName, pageNoteMarkdown, textBlob } from "@/lib/books/export";
import { bookKeys, bookQueries } from "@/lib/books/queries";
import { BK_ICON_BUTTON } from "./reader-styles";

interface Props {
  bookId: string;
  title: string;
  page: number;
  /** Menyu ochiq bo'lganda panel yashirinmasligi uchun. */
  onOpenChange: (open: boolean) => void;
}

const ITEM =
  "text-ds-ink hover:bg-ds-canvas flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium transition-colors disabled:opacity-60";

/** Joriy bet yon daftarini (.md) yuklab olish. Kitob betining o'zi hech qachon yuklanmaydi. */
export function ExportMenu({ bookId, title, page, onOpenChange }: Props) {
  const t = useTranslations("books.reader.export");
  const requireAuth = useRequireAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  function toggle(next: boolean) {
    setOpen(next);
    onOpenChange(next);
    if (!next) setError(false);
  }

  async function run() {
    setBusy(true);
    setError(false);
    try {
      const note =
        queryClient.getQueryData<PageNote>(bookKeys.note(bookId, page)) ??
        (await queryClient.fetchQuery(bookQueries.note(bookId, page)));
      downloadBlob(
        textBlob(pageNoteMarkdown(title, { page, text: note.text }, t("pageHeading", { page }))),
        pageFileName(title, page, "md"),
      );
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={toggle}
      label={t("menu")}
      className="w-72 p-2"
      trigger={(props) => (
        <button
          type="button"
          className={BK_ICON_BUTTON}
          aria-label={t("menu")}
          title={t("menu")}
          {...props}
          onClick={() => requireAuth(() => props.onClick(), "note")}
        >
          <FileDown className="size-5" aria-hidden />
        </button>
      )}
    >
      <div className="flex flex-col">
        <button type="button" className={ITEM} disabled={busy} onClick={() => void run()}>
          {busy ? (
            <Loader2 className="size-5 animate-spin" aria-hidden />
          ) : (
            <FileDown className="size-5" aria-hidden />
          )}
          {t("notes")}
        </button>
        <p role="status" className="text-ds-muted px-3 pt-1 pb-2 text-xs">
          {error ? t("failed") : ""}
        </p>
      </div>
    </Popover>
  );
}
