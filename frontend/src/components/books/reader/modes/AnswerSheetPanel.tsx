"use client";

import { useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/hooks/useToast";
import type { useTestSheet } from "@/hooks/useTestSheet";
import type { AnswerAttemptDetail } from "@/lib/books/api";
import { choiceLetters, questionKey } from "@/lib/books/test-mode";
import { cn } from "@/lib/utils/cn";
import { AnswerChoices } from "./AnswerChoices";
import { TestResultDialog } from "./TestResultDialog";

type Sheet = ReturnType<typeof useTestSheet>;

export interface AnswerSheetPanelProps {
  bookId: string;
  signedIn: boolean;
  sheet: Sheet;
  page: number;
  onGoPage: (page: number) => void;
  onRequireAuth: () => void;
}

/**
 * Yon daftardagi «Javoblar» bo'limi: kitobdagi barcha savollar bet bo'yicha (javob belgilanadi),
 * «Tekshirish» tugmasi va urinishlar tarixi. Kalit hech qachon yuklanmaydi — ball serverda hisoblanadi.
 */
export function AnswerSheetPanel({
  bookId,
  signedIn,
  sheet,
  page,
  onGoPage,
  onRequireAuth,
}: AnswerSheetPanelProps) {
  const t = useTranslations("books.test.panel");
  const format = useFormatter();
  const { toast } = useToast();
  const [result, setResult] = useState<AnswerAttemptDetail | { id: string } | null>(null);
  const { sheet: data, answers, progress } = sheet;

  const pages = useMemo(() => {
    const groups = new Map<number, NonNullable<typeof data>["questions"]>();
    for (const item of data?.questions ?? []) {
      groups.set(item.page, [...(groups.get(item.page) ?? []), item]);
    }
    return [...groups.entries()].sort((a, b) => a[0] - b[0]);
  }, [data]);

  if (!signedIn) {
    return (
      <div className="text-bk-muted flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-sm">
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
  if (sheet.loading) {
    return (
      <p role="status" className="text-bk-muted p-4 text-sm">
        {t("loading")}
      </p>
    );
  }
  if (sheet.error || !data) {
    return (
      <div
        role="alert"
        className="text-bk-muted flex flex-col items-center gap-3 p-6 text-center text-sm"
      >
        {t("loadError")}
        <Button variant="secondary" size="sm" onClick={sheet.reload}>
          {t("retry")}
        </Button>
      </div>
    );
  }
  if (data.questions.length === 0) {
    return <p className="text-bk-muted p-6 text-center text-sm">{t("noKey")}</p>;
  }

  const letters = choiceLetters(data.choices);

  async function check() {
    try {
      setResult(await sheet.check());
    } catch {
      toast({ variant: "error", title: t("checkFailed") });
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-bk-line flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <p className="min-w-0 flex-1 text-sm" aria-live="polite">
          {t("progress", { answered: progress.answered, total: progress.total })}
        </p>
        <Button
          size="sm"
          onClick={() => void check()}
          loading={sheet.checking}
          disabled={progress.answered === 0}
        >
          {t("check")}
        </Button>
      </div>
      {sheet.answerFailed && (
        <p role="alert" className="text-danger px-4 pt-2 text-xs">
          {t("answerFailed")}
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <ol className="flex flex-col">
          {pages.map(([number, questions]) => (
            <li
              key={number}
              data-sheet-page={number}
              className={cn(
                "border-bk-line border-b px-4 py-3",
                number === page && "bg-bk-accent-soft/50",
              )}
            >
              <button
                type="button"
                onClick={() => onGoPage(number)}
                aria-current={number === page ? "page" : undefined}
                className="text-bk-accent mb-2 text-sm font-semibold underline-offset-2 hover:underline"
              >
                {t("page", { page: number })}
              </button>
              <ul className="flex flex-col gap-2">
                {questions.map((question) => (
                  <li key={question.question} className="flex items-center gap-2">
                    <span className="w-7 shrink-0 text-right text-sm font-semibold tabular-nums">
                      {question.question}
                    </span>
                    <AnswerChoices
                      question={question.question}
                      kind={question.kind}
                      letters={letters}
                      value={answers.get(questionKey(question.page, question.question))}
                      onChange={(answer) =>
                        sheet.setAnswer(question.page, question.question, answer)
                      }
                      className="min-w-0 flex-1 flex-wrap"
                    />
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>

        <section aria-label={t("history")} className="px-4 py-3">
          <h3 className="text-sm font-semibold">{t("history")}</h3>
          {sheet.attempts.length === 0 ? (
            <p className="text-bk-muted mt-1 text-sm">{t("historyEmpty")}</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1">
              {sheet.attempts.map((attempt) => (
                <li key={attempt.id}>
                  <button
                    type="button"
                    data-attempt={attempt.id}
                    onClick={() => setResult({ id: attempt.id })}
                    className="border-bk-line hover:bg-bk-accent-soft flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border px-3 text-left text-sm transition-colors"
                  >
                    <span className="text-bk-muted">
                      {format.dateTime(new Date(attempt.created_at), {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="font-semibold tabular-nums">
                      {attempt.score} / {attempt.total}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <TestResultDialog
        bookId={bookId}
        attempt={result}
        onClose={() => setResult(null)}
        onGoPage={onGoPage}
      />
    </div>
  );
}
