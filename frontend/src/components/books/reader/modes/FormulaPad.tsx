"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  MATH_SNIPPETS,
  SNIPPET_GROUPS,
  type MathSnippet,
  type SnippetGroup,
} from "@/lib/books/math";
import { cn } from "@/lib/utils/cn";

export interface FormulaPadProps {
  onInsert: (snippet: MathSnippet) => void;
}

/** Tez belgilar: kasr, ildiz, daraja, indeks, integral va yunon harflari. Bosilsa kursor o'rniga qo'yiladi. */
export function FormulaPad({ onInsert }: FormulaPadProps) {
  const t = useTranslations("books.math");
  const [group, setGroup] = useState<SnippetGroup>("structure");

  return (
    <div className="flex flex-col gap-2">
      <div role="tablist" aria-label={t("pad.label")} className="flex gap-1">
        {SNIPPET_GROUPS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={group === id}
            onClick={() => setGroup(id)}
            className={cn(
              "h-9 rounded-lg px-3 text-sm font-medium transition-colors",
              group === id ? "bg-primary-soft text-link" : "text-muted hover:bg-subtle",
            )}
          >
            {t(`pad.groups.${id}`)}
          </button>
        ))}
      </div>
      <div role="group" aria-label={t(`pad.groups.${group}`)} className="flex flex-wrap gap-1.5">
        {MATH_SNIPPETS[group].map((snippet) => (
          <button
            key={snippet.id}
            type="button"
            // Matn maydonidan fokus ketmasin: kursor o'rni saqlanadi.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onInsert(snippet)}
            aria-label={t(`pad.items.${snippet.id}`)}
            title={t(`pad.items.${snippet.id}`)}
            className="border-border bg-surface hover:bg-subtle inline-flex size-11 items-center justify-center rounded-lg border text-lg font-medium transition-colors sm:size-10"
          >
            <span aria-hidden>{snippet.glyph}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
