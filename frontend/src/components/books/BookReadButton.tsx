"use client";

import { BookOpen, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { buttonVariants } from "@/components/ui/Button";
import { useBookProgress } from "@/hooks/useBookProgress";
import { Link } from "@/lib/i18n/navigation";
import { progressPercent, resumeState } from "@/lib/books/reader";
import { bookReaderPath } from "@/lib/utils/routes";

/**
 * Kitob sahifasidagi asosiy tugma: "O'qishni boshlash" / "Davom ettirish (45-bet)" / "Qayta o'qish".
 * Saqlangan bet aniqlanguncha "boshlash" ko'rsatiladi (tugma joyi o'zgarmaydi), keyin matn almashadi.
 */
export function BookReadButton({ bookId, pageCount }: { bookId: string; pageCount: number }) {
  const t = useTranslations("books.detail");
  const { lastPage } = useBookProgress(bookId);
  const state = resumeState(lastPage, pageCount);

  const href =
    state === "continue" && lastPage ? bookReaderPath(bookId, lastPage) : bookReaderPath(bookId);
  const Icon = state === "finished" ? RotateCcw : BookOpen;
  const label =
    state === "continue" && lastPage
      ? t("resumeAt", { page: lastPage })
      : state === "finished"
        ? t("read")
        : t("start");

  return (
    <div className="flex flex-col items-start gap-2">
      <Link href={href} className={buttonVariants({ size: "lg", className: "w-full sm:w-auto" })}>
        <Icon className="size-5" aria-hidden />
        {label}
      </Link>
      {lastPage && lastPage > 1 && (
        <p className="text-muted text-sm">
          {t("progress", { percent: progressPercent(lastPage, pageCount) })}
        </p>
      )}
    </div>
  );
}
