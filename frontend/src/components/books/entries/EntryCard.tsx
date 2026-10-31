"use client";

import { useState } from "react";
import { Bookmark, Highlighter, PenLine, Trash2, Type, type LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useEntryMutations } from "@/hooks/useEntryMutations";
import { useToast } from "@/hooks/useToast";
import type { PageEntry } from "@/lib/books/api";
import { summarizeEntry } from "@/lib/books/entries";
import { Link } from "@/lib/i18n/navigation";
import { bookReaderPath } from "@/lib/utils/routes";
import { EntryThumb } from "./EntryThumb";
import { HighlightColors } from "./HighlightColors";

interface Chip {
  Icon: LucideIcon;
  text: string;
}

/** Bitta bet: eskiz, yon daftar matni, belgilar; bosilsa o'sha betda o'qish oynasi ochiladi. */
export function EntryCard({ entry }: { entry: PageEntry }) {
  const t = useTranslations("books.entries");
  const { toast } = useToast();
  const { remove, recolor } = useEntryMutations();
  const [confirm, setConfirm] = useState(false);
  const summary = summarizeEntry(entry);
  const highlights = entry.annotations.filter((item) => item.type === "highlight");
  const color = summary.colors.length === 1 ? summary.colors[0] : null;
  const href = bookReaderPath(entry.book.id, entry.page);

  const chips: Chip[] = [];
  if (summary.highlights > 0)
    chips.push({ Icon: Highlighter, text: t("counts.highlights", { count: summary.highlights }) });
  if (summary.drawings > 0)
    chips.push({ Icon: PenLine, text: t("counts.drawings", { count: summary.drawings }) });
  if (summary.texts > 0)
    chips.push({ Icon: Type, text: t("counts.texts", { count: summary.texts }) });
  if (summary.bookmarked) chips.push({ Icon: Bookmark, text: t("counts.bookmark") });

  function recolorAll(next: string) {
    for (const item of highlights) {
      recolor.mutate(
        { entry, annotationId: item.id, color: next },
        { onError: () => toast({ variant: "error", title: t("recolorFailed") }) },
      );
    }
  }

  return (
    <li className="border-border bg-surface grid grid-cols-[6.5rem_minmax(0,1fr)] gap-4 rounded-xl border p-3 sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:p-4">
      <Link href={href} className="block self-start" aria-label={t("open", { page: entry.page })}>
        <EntryThumb entry={entry} alt={t("thumbAlt", { page: entry.page })} />
      </Link>
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <Link href={href} className="text-foreground text-lg font-bold hover:underline">
            {t("page", { page: entry.page })}
          </Link>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("delete.action", { page: entry.page })}
            onClick={() => setConfirm(true)}
            className="-mt-1 -mr-1 size-9 sm:size-9"
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        </div>
        {summary.hasNote && (
          <p className="text-foreground line-clamp-4 text-sm whitespace-pre-line">{entry.note}</p>
        )}
        {chips.length > 0 && (
          <ul className="text-muted flex flex-wrap gap-x-3 gap-y-1 text-xs">
            {chips.map(({ Icon, text }) => (
              <li key={text} className="inline-flex items-center gap-1">
                <Icon className="size-3.5" aria-hidden />
                {text}
              </li>
            ))}
          </ul>
        )}
        {highlights.length > 0 && (
          <HighlightColors label={t("recolor")} value={color} onChange={recolorAll} />
        )}
      </div>
      <Dialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t("delete.title", { page: entry.page })}
        description={t("delete.text")}
      >
        <div className="flex justify-end gap-2 p-5 pt-0">
          <Button variant="secondary" onClick={() => setConfirm(false)}>
            {t("delete.cancel")}
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              setConfirm(false);
              remove.mutate(
                { entry },
                { onError: () => toast({ variant: "error", title: t("delete.failed") }) },
              );
            }}
          >
            {t("delete.confirm")}
          </Button>
        </div>
      </Dialog>
    </li>
  );
}
