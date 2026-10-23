"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";

/** Shundan uzun tavsif "Batafsil" bilan qisqartiriladi. */
const SHORT_LIMIT = 160;

/** Kitob tavsifi: qisqa ko'rinadi, "Batafsil" bosilsa to'liq ochiladi. */
export function PdfBookDescription({ text }: { text: string }) {
  const t = useTranslations("pdfBooks.description");
  const [expanded, setExpanded] = useState(false);
  const description = text.trim();
  if (!description) return null;
  const long = description.length > SHORT_LIMIT || description.includes("\n");

  return (
    <div data-testid="pdf-description" className="flex flex-col items-start gap-1">
      <p
        className={cn(
          "text-muted max-w-prose text-sm whitespace-pre-line",
          long && !expanded && "line-clamp-2",
        )}
      >
        {description}
      </p>
      {long && (
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
          className="text-link -my-2 min-h-11 text-sm font-medium underline-offset-4 hover:underline"
        >
          {t(expanded ? "less" : "more")}
        </button>
      )}
    </div>
  );
}
