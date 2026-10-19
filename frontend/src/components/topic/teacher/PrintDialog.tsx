"use client";

import { useState } from "react";
import { Printer } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { toggleValue } from "@/lib/utils/teacher-filters";
import { useTeacherStore } from "@/stores/teacher.store";

export interface PrintSection {
  /** Bo'lim elementining DOM id'si. */
  id: string;
  label: string;
}

export interface PrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sections: PrintSection[];
}

const PRINT_HIDDEN_ATTR = "data-print-hidden";

/** Tanlangan bo'limlarni chop etadi: qolganlariga vaqtincha `data-print-hidden` qo'yiladi (print stylesheet yashiradi). */
export function PrintDialog({ open, onOpenChange, sections }: PrintDialogProps) {
  const t = useTranslations("topic.teacher.print");
  const allIds = sections.map((section) => section.id);
  const [selected, setSelected] = useState<string[]>(allIds);
  const [withAnswers, setWithAnswers] = useState(false);

  const print = () => {
    const hidden = allIds
      .filter((id) => !selected.includes(id))
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => element !== null);
    const answersBefore = useTeacherStore.getState().showAnswers;

    for (const element of hidden) element.setAttribute(PRINT_HIDDEN_ATTR, "");
    if (withAnswers) useTeacherStore.getState().setShowAnswers(true);

    const restore = () => {
      for (const element of hidden) element.removeAttribute(PRINT_HIDDEN_ATTR);
      useTeacherStore.getState().setShowAnswers(answersBefore);
    };
    window.addEventListener("afterprint", restore, { once: true });

    onOpenChange(false);
    // Dialog yopilib, javoblar chizilib bo'lgach chop etish oynasi ochiladi.
    setTimeout(() => window.print(), 100);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("title")}
      description={t("description")}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          print();
        }}
        className="flex flex-col gap-4"
      >
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-2 text-sm font-medium">{t("sections")}</legend>
          {sections.map((section) => (
            <label key={section.id} className="flex min-h-10 cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={selected.includes(section.id)}
                onChange={() => setSelected((current) => toggleValue(current, section.id))}
                className="accent-primary-600 size-5"
              />
              {section.label}
            </label>
          ))}
        </fieldset>
        <label className="flex min-h-10 cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={withAnswers}
            onChange={(event) => setWithAnswers(event.target.checked)}
            className="accent-primary-600 size-5"
          />
          {t("withAnswers")}
        </label>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={selected.length === 0}>
            <Printer className="size-4" aria-hidden />
            {t("action")}
          </Button>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
