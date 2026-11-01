"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { SOLUTION_BODY_MAX, SOLUTION_TITLE_MAX } from "@/lib/books/annotations";
import { insertSnippet, type MathSnippet } from "@/lib/books/math";
import { FormulaPad } from "./FormulaPad";
import { MathText } from "./MathText";

export interface SolutionDraft {
  title: string;
  body: string;
}

export interface SolutionDialogProps {
  open: boolean;
  /** Mavjud yechimni tahrirlash bo'lsa `true` (o'chirish tugmasi chiqadi). */
  editing: boolean;
  initial: SolutionDraft;
  page: number;
  onSave: (draft: SolutionDraft) => void;
  onDelete: () => void;
  onClose: () => void;
}

function SolutionForm({
  editing,
  initial,
  onSave,
  onDelete,
  onClose,
}: Omit<SolutionDialogProps, "open" | "page">) {
  const t = useTranslations("books.math.dialog");
  const area = useRef<HTMLTextAreaElement>(null);
  const [title, setTitle] = useState(initial.title);
  const [body, setBody] = useState(initial.body);

  function insert(snippet: MathSnippet) {
    const element = area.current;
    const start = element?.selectionStart ?? body.length;
    const end = element?.selectionEnd ?? body.length;
    const next = insertSnippet(body, start, end, snippet);
    setBody(next.value.slice(0, SOLUTION_BODY_MAX));
    requestAnimationFrame(() => {
      element?.focus();
      element?.setSelectionRange(next.caret, next.caret);
    });
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({ title: title.trim(), body });
      }}
    >
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("titleLabel")}
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={SOLUTION_TITLE_MAX}
          placeholder={t("titlePlaceholder")}
          className="border-border bg-surface h-11 rounded-lg border px-3 text-base font-normal sm:h-10"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("bodyLabel")}
        <textarea
          ref={area}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={SOLUTION_BODY_MAX}
          rows={6}
          autoFocus={!editing}
          spellCheck={false}
          placeholder={t("bodyPlaceholder")}
          className="border-border bg-surface min-h-32 resize-y rounded-lg border p-3 font-mono text-[0.9375rem] leading-relaxed font-normal"
        />
      </label>

      <FormulaPad onInsert={insert} />

      <section aria-label={t("preview")} className="flex flex-col gap-1">
        <h3 className="text-muted text-sm font-medium">{t("preview")}</h3>
        <div
          aria-live="polite"
          className="border-border bg-subtle min-h-16 rounded-lg border p-3 text-base"
        >
          {body.trim() ? (
            <MathText text={body} />
          ) : (
            <span className="text-muted">{t("previewEmpty")}</span>
          )}
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
        {editing && (
          <Button variant="ghost" onClick={onDelete} className="text-danger mr-auto">
            {t("delete")}
          </Button>
        )}
        <Button variant="secondary" onClick={onClose}>
          {t("cancel")}
        </Button>
        <Button type="submit">{t("save")}</Button>
      </div>
    </form>
  );
}

/** Misol yechimi: sarlavha, matn (LaTeX bilan), tez belgilar paneli va jonli ko'rinish. */
export function SolutionDialog({ open, page, ...props }: SolutionDialogProps) {
  const t = useTranslations("books.math.dialog");
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) props.onClose();
      }}
      title={props.editing ? t("editTitle", { page }) : t("createTitle", { page })}
      className="max-w-xl"
    >
      {open && <SolutionForm {...props} />}
    </Dialog>
  );
}
