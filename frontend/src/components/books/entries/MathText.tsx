"use client";

import { useEffect, useMemo, useState } from "react";
import type katexModule from "katex";
import "katex/dist/katex.min.css";
import { hasMath, splitMath } from "@/lib/books/math";
import { cn } from "@/lib/utils/cn";

type Katex = typeof katexModule;

let katexPromise: Promise<Katex> | null = null;

/** KaTeX faqat formula bor matnda yuklanadi (alohida chunk). */
function loadKatex(): Promise<Katex> {
  katexPromise ??= import("katex").then((module) => module.default);
  return katexPromise;
}

function useKatex(needed: boolean): Katex | null {
  const [katex, setKatex] = useState<Katex | null>(null);
  useEffect(() => {
    if (!needed || katex) return;
    let cancelled = false;
    void loadKatex().then((loaded) => {
      if (!cancelled) setKatex(() => loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [needed, katex]);
  return katex;
}

export interface MathTextProps {
  text: string;
  className?: string;
}

/**
 * Matn + formulalar: `$x^2$` (qator ichida) va `$$...$$` (alohida qatorda) KaTeX bilan chiziladi.
 * Noto'g'ri LaTeX xato bermaydi, qizil matn bilan ko'rsatiladi; KaTeX yuklangunicha formula manba matni.
 */
export function MathText({ text, className }: MathTextProps) {
  const needed = useMemo(() => hasMath(text), [text]);
  const katex = useKatex(needed);
  const segments = useMemo(() => splitMath(text), [text]);

  return (
    <div className={cn("break-words whitespace-pre-wrap", className)}>
      {segments.map((segment, index) => {
        if (segment.kind === "text") return <span key={index}>{segment.value}</span>;
        const block = segment.kind === "block";
        if (!katex) {
          return (
            <code key={index} className={block ? "block" : undefined}>
              {segment.value}
            </code>
          );
        }
        const html = katex.renderToString(segment.value, {
          displayMode: block,
          throwOnError: false,
          trust: false,
          strict: "ignore",
          output: "htmlAndMathml",
        });
        return (
          <span
            key={index}
            data-math={segment.kind}
            className={block ? "block overflow-x-auto py-1" : undefined}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      })}
    </div>
  );
}
