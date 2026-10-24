"use client";

import { useState } from "react";
import { Flag, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { Dialog } from "@/components/ui/Dialog";
import { SupportForm } from "./SupportForm";

/**
 * "Xato topdingizmi?": formani mavzu va sahifa manzili bilan ochadi. `card` — kitob sahifasidagi
 * to'liq blok (sarlavha + izoh), aks holda oxiridagi kichik havola.
 */
export function ReportErrorLink({ topicId, card = false }: { topicId: string; card?: boolean }) {
  const t = useTranslations("support.reportError");
  const tp = useTranslations("pdfBooks.page");
  const [open, setOpen] = useState(false);

  return (
    <div className="present:hidden print:hidden">
      {card ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="bg-surface-2 text-muted hover:bg-brand-soft flex min-h-11 w-full items-start gap-3 rounded-[0.875rem] p-4 text-left text-sm leading-normal transition-colors"
        >
          <TriangleAlert
            className="text-group-language mt-0.5 size-[1.125rem] shrink-0"
            aria-hidden
          />
          <span>
            <strong className="text-foreground">{tp("reportTitle")}</strong> {tp("reportText")}
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-muted hover:text-foreground inline-flex items-center gap-1.5 text-sm underline-offset-4 hover:underline"
        >
          <Flag className="size-4" aria-hidden />
          {t("link")}
        </button>
      )}
      <Dialog open={open} onOpenChange={setOpen} title={t("title")} description={t("description")}>
        {open && (
          <SupportForm
            idPrefix="report-error"
            defaultKind="content_error"
            topic={topicId}
            attachPageUrl
            onDone={() => setOpen(false)}
            doneLabel={t("close")}
          />
        )}
      </Dialog>
    </div>
  );
}
