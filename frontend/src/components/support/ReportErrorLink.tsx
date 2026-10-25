"use client";

import { useState } from "react";
import { Flag, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { Dialog } from "@/components/ui/Dialog";
import { SupportForm } from "./SupportForm";

/**
 * "Xato topdingizmi?": formani kitob (va o'qish oynasida — joriy bet) hamda sahifa manzili bilan
 * ochadi. `card` — kitob sahifasidagi to'liq blok (sarlavha + izoh), aks holda oxiridagi kichik havola.
 */
export function ReportErrorLink({
  topicId,
  page,
  card = false,
}: {
  /** Kitob id (`topic` va `pdf_book` sifatida yuboriladi). */
  topicId: string;
  /** O'qish oynasidagi joriy bet. */
  page?: number;
  card?: boolean;
}) {
  const t = useTranslations("support.reportError");
  const tp = useTranslations("pdfBooks.page");
  const tc = useTranslations("pdfBooks.contents");
  const [open, setOpen] = useState(false);

  return (
    <div className="present:hidden print:hidden">
      {card ? (
        <section
          aria-labelledby="report-error-title"
          className="border-ds-warn-border bg-ds-warn-bg font-ui flex flex-col gap-3 rounded-[20px] border p-5"
        >
          <div className="flex items-start gap-3">
            <TriangleAlert className="text-ds-warn-ink mt-0.5 size-5 shrink-0" aria-hidden />
            <div className="flex flex-col gap-1">
              <h2 id="report-error-title" className="text-ds-ink text-base font-extrabold">
                {tp("reportTitle")}
              </h2>
              <p className="text-ds-ink-2 text-sm leading-normal">{tp("reportText")}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="border-ds-warn-border text-ds-warn-ink hover:bg-ds-surface/60 min-h-11 self-start rounded-xl border px-4 text-sm font-bold transition-colors"
          >
            {tc("reportAction")}
          </button>
        </section>
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
            pdfBook={topicId}
            page={page}
            attachPageUrl
            onDone={() => setOpen(false)}
            doneLabel={t("close")}
          />
        )}
      </Dialog>
    </div>
  );
}
