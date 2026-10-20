"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import { useTranslations } from "next-intl";
import { Dialog } from "@/components/ui/Dialog";
import { SupportForm } from "./SupportForm";

/** Mavzu oxiridagi kichik "Xato topdingizmi?" havolasi: formani mavzu va sahifa manzili bilan ochadi. */
export function ReportErrorLink({ topicId }: { topicId: string }) {
  const t = useTranslations("support.reportError");
  const [open, setOpen] = useState(false);

  return (
    <div className="present:hidden print:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-muted hover:text-foreground inline-flex items-center gap-1.5 text-sm underline-offset-4 hover:underline"
      >
        <Flag className="size-4" aria-hidden />
        {t("link")}
      </button>
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
