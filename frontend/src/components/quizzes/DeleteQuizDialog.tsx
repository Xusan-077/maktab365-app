"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";

interface Props {
  title: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

/** O'chirishni tasdiqlash (`title` berilsa ochiq). */
export function DeleteQuizDialog({ title, onCancel, onConfirm }: Props) {
  const t = useTranslations("quizzes.delete");
  return (
    <Dialog
      open={title !== null}
      onOpenChange={(open) => !open && onCancel()}
      title={t("title")}
      description={t("description", { title: title ?? "" })}
    >
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>
          {t("cancel")}
        </Button>
        <Button variant="danger" onClick={onConfirm}>
          {t("confirm")}
        </Button>
      </div>
    </Dialog>
  );
}
