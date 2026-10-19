"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { registerExample } from "@/lib/utils/example-registry";

export interface SolvedExampleStep {
  text: string;
  /** Serverda KaTeX bilan chizilgan formula. */
  formula?: ReactNode;
}

export interface SolvedExampleProps {
  title?: string;
  steps: SolvedExampleStep[];
}

/** Bosqichma-bosqich ochiladigan yechim. Chop etishda barcha qadamlar ochiladi. */
export function SolvedExample({ title, steps }: SolvedExampleProps) {
  const t = useTranslations("topic.example");
  const [shown, setShown] = useState(1);
  const total = steps.length;
  const done = shown >= total;
  const root = useRef<HTMLDivElement>(null);
  const shownRef = useRef(shown);
  useEffect(() => {
    shownRef.current = shown;
  }, [shown]);

  // O'qituvchi klaviaturasi (bo'sh joy / strelkalar) shu orqali qadamlarni boshqaradi.
  useEffect(() => {
    const set = (value: number) => {
      shownRef.current = value;
      setShown(value);
    };
    return registerExample({
      element: root.current,
      hasNext: () => shownRef.current < total,
      hasPrevious: () => shownRef.current > 1,
      next: () => {
        set(shownRef.current + 1);
        // Yangi qadam ko'rinib turishi uchun (proyektorda pastda qolib ketmasin)
        requestAnimationFrame(() =>
          root.current
            ?.querySelector("ol > li:last-child")
            ?.scrollIntoView({ block: "nearest", behavior: "smooth" }),
        );
      },
      previous: () => set(shownRef.current - 1),
    });
  }, [total]);

  useEffect(() => {
    const showAll = () => flushSync(() => setShown(total));
    window.addEventListener("beforeprint", showAll);
    return () => window.removeEventListener("beforeprint", showAll);
  }, [total]);

  return (
    <div ref={root} className="flex flex-col gap-4">
      {title && <h3 className="text-lg font-semibold">{title}</h3>}
      <ol aria-live="polite" className="flex flex-col gap-4">
        {steps.slice(0, shown).map((step, index) => (
          <li key={index} className="grid grid-cols-[1.75rem_1fr] items-start gap-3">
            <span
              aria-hidden
              className="bg-primary-soft text-primary-soft-foreground mt-0.5 inline-flex size-7 items-center justify-center rounded-full text-sm font-semibold"
            >
              {index + 1}
            </span>
            <div className="min-w-0">
              <span className="sr-only">{t("stepLabel", { current: index + 1, total })}. </span>
              <p>{step.text}</p>
              {step.formula}
            </div>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        {done ? (
          <>
            <p role="status" className="text-muted text-sm">
              {t("done")}
            </p>
            {total > 1 && (
              <Button variant="ghost" size="sm" onClick={() => setShown(1)}>
                {t("restart")}
              </Button>
            )}
          </>
        ) : (
          <>
            <Button onClick={() => setShown((current) => current + 1)}>{t("next")}</Button>
            <Button variant="ghost" onClick={() => setShown(total)}>
              {t("showAll")}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
