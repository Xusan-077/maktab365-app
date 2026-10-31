"use client";

import { useMemo } from "react";
import { Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { useBookExport, type BookExportLabels } from "@/hooks/useBookExport";
import { EXPORT_MAX_PAGES } from "@/lib/books/export";

/** Kitob yozuvlarini ZIP qilib yuklash: progress, bekor qilish, chegara haqida xabar. */
export function BookExportButton({ bookId, title }: { bookId: string; title: string }) {
  const t = useTranslations("books.entries.export");
  const labels = useMemo<BookExportLabels>(
    () => ({
      page: (page) => t("pageHeading", { page }),
      texts: t("texts"),
      notesFile: t("notesFile"),
    }),
    [t],
  );
  const { state, start, cancel } = useBookExport(bookId, title, labels);
  const running = state.status === "running";

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <div className="flex items-center gap-2">
        {running && (
          <Button variant="ghost" size="sm" onClick={cancel}>
            {t("cancel")}
          </Button>
        )}
        <Button variant="secondary" size="sm" loading={running} onClick={() => void start()}>
          {!running && <Download className="size-4" aria-hidden />}
          {running ? t("progress", { done: state.done, total: state.total }) : t("action")}
        </Button>
      </div>
      <p role="status" className="text-muted text-xs">
        {state.status === "done" && state.truncated && t("truncated", { max: EXPORT_MAX_PAGES })}
        {state.status === "done" && !state.truncated && t("done")}
        {state.status === "error" && t("failed")}
      </p>
    </div>
  );
}
