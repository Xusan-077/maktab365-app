"use client";

import { useTranslations } from "next-intl";
import { Dialog } from "@/components/ui/Dialog";
import { READER_SHORTCUTS } from "@/lib/pdf/reader-prefs";

/** Klaviatura yorliqlari ro'yxati (`?` bilan ochiladi). */
export function ReaderShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("pdfBooks.shortcuts");
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t("title")}>
      <dl className="flex flex-col gap-2" data-testid="reader-shortcuts">
        {READER_SHORTCUTS.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-4 text-sm">
            <dt>{t(item.id)}</dt>
            <dd className="flex shrink-0 gap-1">
              {item.keys.map((key) => (
                <kbd key={key} className="bg-subtle rounded border px-1.5 py-0.5 text-xs">
                  {key}
                </kbd>
              ))}
            </dd>
          </div>
        ))}
      </dl>
    </Dialog>
  );
}
