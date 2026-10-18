"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { cn } from "@/lib/utils/cn";
import { DEMO_LESSONS, DEMO_OPTION_INDEXES, type DemoLessonId } from "./demo-lessons";

type OptionStatus = "idle" | "correct" | "wrong";

const optionStyles: Record<OptionStatus, string> = {
  idle: "border-border bg-surface hover:bg-subtle",
  correct: "border-success bg-success-soft text-success-soft-foreground",
  wrong: "border-danger bg-danger-soft text-danger-soft-foreground",
};

/** Hero yonidagi mini-dars: fan tanlanadi, qisqa tushuntirish, bitta savol va javobga munosabat. */
export function LiveLessonDemo() {
  const t = useTranslations("home.demo");
  const reduceMotion = useReducedMotion();
  const [lessonId, setLessonId] = useState<DemoLessonId>("math");
  const [picked, setPicked] = useState<number | null>(null);
  const [switched, setSwitched] = useState(false);

  const lesson = DEMO_LESSONS.find((item) => item.id === lessonId) ?? DEMO_LESSONS[0];
  const key = (name: string) => `subjects.${lesson.id}.${name}`;
  const solved = picked === lesson.correctIndex;

  function selectLesson(id: DemoLessonId) {
    if (id === lessonId) return;
    setLessonId(id);
    setPicked(null);
    setSwitched(true);
  }

  function statusOf(index: number): OptionStatus {
    if (picked !== index) return "idle";
    return index === lesson.correctIndex ? "correct" : "wrong";
  }

  function animateOf(status: OptionStatus) {
    if (reduceMotion) return { scale: 1, x: 0 };
    if (status === "correct") return { scale: [1, 1.04, 1], x: 0 };
    if (status === "wrong") return { scale: 1, x: [0, -6, 6, -4, 4, 0] };
    return { scale: 1, x: 0 };
  }

  return (
    <Card className="flex flex-col gap-5 p-5 shadow-lg sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Badge variant="accent">{t("badge")}</Badge>
        <div role="group" aria-label={t("subjectLabel")} className="flex gap-2">
          {DEMO_LESSONS.map((item) => (
            <Chip
              key={item.id}
              selected={item.id === lessonId}
              onClick={() => selectLesson(item.id)}
              className="h-10 px-4"
            >
              {t(`subjects.${item.id}.name`)}
            </Chip>
          ))}
        </div>
      </div>

      <motion.div
        key={lessonId}
        initial={switched && !reduceMotion ? { opacity: 0, y: 6 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex flex-col gap-5"
      >
        <div>
          <p className="text-muted mb-1 text-xs font-semibold tracking-wide uppercase">
            {t("explanationLabel")}
          </p>
          <p className="text-foreground text-base">{t(key("explanation"))}</p>
          {lesson.verbatimExample && (
            <p
              lang="en"
              className="bg-accent-soft text-accent-soft-foreground mt-2 rounded-lg px-3 py-2 font-medium"
            >
              {t(key("exampleVerbatim"))}
            </p>
          )}
        </div>

        <div>
          <p className="text-muted mb-1 text-xs font-semibold tracking-wide uppercase">
            {t("questionLabel")}
          </p>
          <p className="text-foreground text-base font-medium">{t(key("question"))}</p>
          {lesson.verbatimQuestion && (
            <p lang="en" className="text-foreground mt-1 text-base font-medium">
              {t(key("questionVerbatim"))}
            </p>
          )}

          <div role="group" aria-label={t("optionsLabel")} className="mt-3 flex flex-col gap-2">
            {DEMO_OPTION_INDEXES.map((index) => {
              const status = statusOf(index);
              return (
                <motion.button
                  key={index}
                  type="button"
                  disabled={solved && status !== "correct"}
                  onClick={() => setPicked(index)}
                  animate={animateOf(status)}
                  transition={{ duration: 0.35 }}
                  className={cn(
                    "flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border px-4 text-left text-sm font-medium transition-colors disabled:cursor-default disabled:opacity-60",
                    optionStyles[status],
                  )}
                >
                  <span lang={lesson.verbatimQuestion ? "en" : undefined}>
                    {t(key(`option${index}`))}
                  </span>
                  {status === "correct" && <Check className="size-4 shrink-0" aria-hidden />}
                  {status === "wrong" && <X className="size-4 shrink-0" aria-hidden />}
                </motion.button>
              );
            })}
          </div>
        </div>
      </motion.div>

      <div role="status" aria-live="polite" className="min-h-[3.5rem]">
        <AnimatePresence mode="wait" initial={false}>
          {picked !== null && (
            <motion.div
              key={`${lessonId}-${picked}`}
              initial={reduceMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className={cn(
                "rounded-lg px-3 py-2 text-sm",
                solved
                  ? "bg-success-soft text-success-soft-foreground"
                  : "bg-danger-soft text-danger-soft-foreground",
              )}
            >
              <p className="font-semibold">{solved ? t("correctTitle") : t("wrongTitle")}</p>
              <p>{solved ? t(key("correct")) : t(key("wrong"))}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <p className="text-muted text-xs">{t("footnote")}</p>
    </Card>
  );
}
