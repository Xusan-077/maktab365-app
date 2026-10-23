"use client";

import { useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { ANNOTATION_COLORS, NOTE_MAX, type AnnotationColor } from "@/lib/pdf/annotations";
import { cn } from "@/lib/utils/cn";

export interface AnnotationDialogProps {
  /** Mavjud belgini tahrirlash (rang va eslatma) yoki yangisini yaratish. */
  initial: { color: AnnotationColor; note: string };
  editing: boolean;
  onSave: (value: { color: AnnotationColor; note: string }) => void;
  onDelete?: () => void;
  onClose: () => void;
}

/** Belgi rangi (3 ta) va qisqa eslatma (≤ 200 belgi). */
export function AnnotationDialog({
  initial,
  editing,
  onSave,
  onDelete,
  onClose,
}: AnnotationDialogProps) {
  const t = useTranslations("pdfBooks.annotations");
  const [color, setColor] = useState(initial.color);
  const [note, setNote] = useState(initial.note);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSave({ color, note: note.trim() });
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={t(editing ? "editTitle" : "newTitle")}
    >
      <form onSubmit={submit} className="flex flex-col gap-4" data-testid="annotation-form">
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">{t("color")}</legend>
          <div className="flex gap-3">
            {ANNOTATION_COLORS.map((value) => (
              <label key={value} className="cursor-pointer">
                <input
                  type="radio"
                  name="annotation-color"
                  value={value}
                  checked={color === value}
                  onChange={() => setColor(value)}
                  className="peer sr-only"
                />
                <span
                  data-color={value}
                  className={cn(
                    "pdf-note-swatch peer-focus-visible:outline-ring flex size-11 items-center justify-center rounded-full border-2 text-xs font-medium peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2",
                    color === value ? "border-foreground" : "border-border",
                  )}
                >
                  <span className="sr-only">{t(`colors.${value}`)}</span>
                  {color === value ? "✓" : ""}
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">{t("note")}</span>
          <textarea
            value={note}
            maxLength={NOTE_MAX}
            rows={3}
            onChange={(event) => setNote(event.target.value)}
            placeholder={t("notePlaceholder")}
            data-testid="annotation-note"
            className="border-border bg-surface placeholder:text-muted rounded-lg border px-3 py-2 text-base"
          />
          <span className="text-muted self-end text-xs tabular-nums">
            {note.length} / {NOTE_MAX}
          </span>
        </label>

        <div className="flex flex-wrap items-center justify-between gap-2">
          {editing && onDelete ? (
            <Button variant="danger" onClick={onDelete} data-testid="annotation-delete">
              <Trash2 className="size-4" aria-hidden />
              {t("delete")}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button type="submit" data-testid="annotation-save">
              {t("save")}
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
