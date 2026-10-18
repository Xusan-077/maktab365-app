"use client";

import { useId, useState, type FormEvent } from "react";
import { ArrowDown, ArrowUp, CircleAlert, CircleCheck, Lightbulb } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import type { Resolved } from "@/lib/i18n/localize-blocks";
import { cn } from "@/lib/utils/cn";
import { useTeacherStore } from "@/stores/teacher.store";
import { isCorrectResponse, type ExerciseResponse } from "@/lib/utils/exercise";
import type { ExerciseBlock } from "@/types/topic";

export type ExerciseView = Resolved<ExerciseBlock>;

type Status = "idle" | "correct" | "incorrect";

export interface ExerciseCardProps {
  exercise: ExerciseView;
  order: number;
  onChecked: (exerciseId: string, correct: boolean) => void;
}

const optionClasses =
  "border-border bg-surface hover:bg-subtle has-[:checked]:border-primary-600 has-[:checked]:bg-primary-soft has-[:disabled]:cursor-default has-[:disabled]:hover:bg-surface flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border px-4 py-2 transition-colors";

/** Boshlang'ich holat: matn mashqida bo'sh qator, tartiblashda — berilgan (aralash) tartib. */
function initialResponse(exercise: ExerciseView): ExerciseResponse | null {
  if (exercise.answerType === "input") return "";
  if (exercise.answerType === "order") return exercise.items.map((_, index) => index);
  return null;
}

export function ExerciseCard({ exercise, order, onChecked }: ExerciseCardProps) {
  const t = useTranslations("topic.exercise");
  const uid = useId();
  const [response, setResponse] = useState<ExerciseResponse | null>(() =>
    initialResponse(exercise),
  );
  const [status, setStatus] = useState<Status>("idle");
  const [missing, setMissing] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const [explanationOpen, setExplanationOpen] = useState(false);

  // O'qituvchi global toggle: javob va izoh barcha mashqda ko'rsatiladi.
  const showAnswers = useTeacherStore((state) => state.showAnswers);
  const solved = status === "correct";
  const hintId = `${uid}-hint`;
  const explanationId = `${uid}-explanation`;
  const feedbackId = `${uid}-feedback`;

  const choose = (value: ExerciseResponse) => {
    setResponse(value);
    setMissing(false);
    setStatus((current) => (current === "incorrect" ? "idle" : current));
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (solved) return;
    if (response === null || (typeof response === "string" && !response.trim())) {
      setMissing(true);
      return;
    }
    const correct = isCorrectResponse(exercise, response);
    setStatus(correct ? "correct" : "incorrect");
    if (correct) setExplanationOpen(true);
    onChecked(exercise.id, correct);
  };

  const move = (from: number, to: number) => {
    if (!Array.isArray(response) || to < 0 || to >= response.length) return;
    const next = [...response];
    [next[from], next[to]] = [next[to], next[from]];
    choose(next);
  };

  const correctAnswerText = (() => {
    switch (exercise.answerType) {
      case "choice":
        return exercise.options[exercise.answer];
      case "truefalse":
        return t(exercise.answer ? "true" : "false");
      case "order":
        return exercise.answer.map((index) => exercise.items[index]).join(" → ");
      case "input":
        return exercise.answer[0];
    }
  })();

  const radios =
    exercise.answerType === "choice"
      ? exercise.options.map((label, index) => ({ label, value: index }))
      : exercise.answerType === "truefalse"
        ? [
            { label: t("true"), value: true },
            { label: t("false"), value: false },
          ]
        : [];

  return (
    <form
      onSubmit={submit}
      className="border-border bg-surface flex flex-col gap-4 rounded-xl border p-4 sm:p-5 print:break-inside-avoid"
    >
      <fieldset className="flex min-w-0 flex-col gap-3" aria-describedby={feedbackId}>
        <legend className="mb-3 w-full">
          <span className="text-muted block text-sm font-medium">{t("label", { order })}</span>
          <span className="mt-1 block text-lg font-medium">{exercise.question}</span>
        </legend>
        {exercise.answerType === "input" ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${uid}-answer`} className="text-sm font-medium">
              {t("answerLabel")}
            </label>
            <input
              id={`${uid}-answer`}
              type="text"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={typeof response === "string" ? response : ""}
              readOnly={solved}
              placeholder={t("answerPlaceholder")}
              onChange={(event) => choose(event.target.value)}
              className="border-border bg-surface placeholder:text-muted read-only:bg-subtle h-12 w-full max-w-sm rounded-lg border px-4 text-base"
            />
          </div>
        ) : exercise.answerType === "order" ? (
          <div className="flex flex-col gap-2">
            <p className="text-muted text-sm">{t("orderHint")}</p>
            <ol className="flex flex-col gap-2">
              {(Array.isArray(response) ? response : []).map((itemIndex, position, current) => (
                <li
                  key={itemIndex}
                  className="border-border bg-surface flex min-h-12 items-center gap-3 rounded-lg border py-2 pr-2 pl-4"
                >
                  <span aria-hidden className="text-muted w-5 shrink-0 text-sm font-medium">
                    {position + 1}
                  </span>
                  <span className="min-w-0 flex-1">{exercise.items[itemIndex]}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={solved || position === 0}
                    aria-label={t("moveUp", { item: exercise.items[itemIndex] })}
                    onClick={() => move(position, position - 1)}
                  >
                    <ArrowUp className="size-4" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={solved || position === current.length - 1}
                    aria-label={t("moveDown", { item: exercise.items[itemIndex] })}
                    onClick={() => move(position, position + 1)}
                  >
                    <ArrowDown className="size-4" aria-hidden />
                  </Button>
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {radios.map((radio) => (
              <label key={String(radio.value)} className={optionClasses}>
                <input
                  type="radio"
                  name={`${uid}-choice`}
                  checked={response === radio.value}
                  disabled={solved}
                  onChange={() => choose(radio.value)}
                  className="accent-primary-600 size-5 shrink-0"
                />
                <span>{radio.label}</span>
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <div className="flex flex-wrap items-center gap-2 print:hidden">
        {!solved && <Button type="submit">{t("check")}</Button>}
        {exercise.hint && !solved && (
          <Button
            variant="secondary"
            aria-expanded={hintOpen}
            aria-controls={hintId}
            onClick={() => setHintOpen((open) => !open)}
          >
            <Lightbulb className="size-4" aria-hidden />
            {hintOpen ? t("hideHint") : t("hint")}
          </Button>
        )}
        {exercise.explanation && status === "incorrect" && (
          <Button
            variant="ghost"
            aria-expanded={explanationOpen}
            aria-controls={explanationId}
            onClick={() => setExplanationOpen((open) => !open)}
          >
            {explanationOpen ? t("hideExplanation") : t("showExplanation")}
          </Button>
        )}
      </div>

      {exercise.hint && hintOpen && !solved && (
        <p
          id={hintId}
          className="bg-accent-soft text-accent-soft-foreground rounded-lg px-4 py-3 text-base"
        >
          {exercise.hint}
        </p>
      )}

      <div id={feedbackId} role="status" aria-live="polite" className="empty:hidden">
        {missing && <p className="text-danger text-sm font-medium">{t("answerRequired")}</p>}
        {status === "correct" && (
          <p className="text-success flex items-center gap-2 font-medium">
            <CircleCheck className="size-5 shrink-0" aria-hidden />
            {t("correct")}
          </p>
        )}
        {status === "incorrect" && (
          <p className="text-danger flex items-center gap-2 font-medium">
            <CircleAlert className="size-5 shrink-0" aria-hidden />
            {t("incorrect")}
          </p>
        )}
      </div>

      {exercise.explanation && explanationOpen && (
        <div
          id={explanationId}
          className={cn(
            "rounded-lg px-4 py-3",
            solved ? "bg-success-soft text-success-soft-foreground" : "bg-subtle",
          )}
        >
          <p className="text-sm font-semibold">{t("explanationTitle")}</p>
          {!solved && <p className="mt-1">{t("correctAnswer", { answer: correctAnswerText })}</p>}
          <p className="mt-1">{exercise.explanation}</p>
        </div>
      )}
      {showAnswers && (
        <div className="border-accent-400 bg-accent-soft text-accent-soft-foreground rounded-lg border-l-4 px-4 py-3">
          <p className="text-sm font-semibold">{t("teacherAnswer")}</p>
          <p className="mt-1 font-medium">{correctAnswerText}</p>
          {exercise.explanation && <p className="mt-1">{exercise.explanation}</p>}
        </div>
      )}
    </form>
  );
}
