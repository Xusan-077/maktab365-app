"use client";

import { Pencil, Sigma } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Annotation } from "@/lib/books/annotations";
import { BK_ICON_BUTTON } from "../reader-styles";
import { MathText } from "./MathText";
import { isSolution } from "./useSolutionEditor";

export interface SolutionListProps {
  page: number;
  items: readonly Annotation[];
  signedIn: boolean;
  onEdit: (id: string) => void;
  /** Mehmon uchun: kirish taklifi. */
  onRequireAuth: () => void;
}

/** Yon daftardagi «Yechimlar» bo'limi: shu betdagi har bir misol yechimi (formulalar chizilgan holda). */
export function SolutionList({ page, items, signedIn, onEdit, onRequireAuth }: SolutionListProps) {
  const t = useTranslations("books.math.panel");
  const solutions = items.filter(isSolution);

  if (!signedIn) {
    return (
      <div className="text-bk-muted flex flex-1 flex-col items-center gap-3 p-6 text-center text-sm">
        {t("guest")}
        <button
          type="button"
          onClick={onRequireAuth}
          className="text-bk-accent font-medium underline underline-offset-2"
        >
          {t("signIn")}
        </button>
      </div>
    );
  }

  if (solutions.length === 0) {
    return (
      <div className="text-bk-muted flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm">
        <Sigma className="size-6" aria-hidden />
        {t("empty", { page })}
      </div>
    );
  }

  return (
    <ol aria-label={t("list", { page })} className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      {solutions.map((item, index) => (
        <li
          key={item.id}
          data-solution-item={item.id}
          className="border-bk-line flex items-start gap-1 border-b py-3 pr-1 pl-4"
        >
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold">
              {item.data.title || t("untitled", { number: index + 1 })}
            </h3>
            {item.data.body.trim() ? (
              <MathText text={item.data.body} className="mt-1 text-[0.9375rem] leading-relaxed" />
            ) : (
              <p className="text-bk-muted mt-1 text-sm">{t("emptyBody")}</p>
            )}
          </div>
          <button
            type="button"
            className={BK_ICON_BUTTON}
            onClick={() => onEdit(item.id)}
            aria-label={t("edit", {
              title: item.data.title || t("untitled", { number: index + 1 }),
            })}
          >
            <Pencil className="size-4" aria-hidden />
          </button>
        </li>
      ))}
    </ol>
  );
}
