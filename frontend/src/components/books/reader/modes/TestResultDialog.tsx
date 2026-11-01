"use client";

import { useQuery } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import type { AnswerAttemptDetail } from "@/lib/books/api";
import { bookQueries } from "@/lib/books/queries";
import { scorePercent, splitAttempt } from "@/lib/books/test-mode";

export interface TestResultDialogProps {
  bookId: string;
  /** Ko'rsatiladigan urinish: yangi tekshirish natijasi yoki tarixdan tanlangani. */
  attempt: AnswerAttemptDetail | { id: string } | null;
  onClose: () => void;
  /** Xato savol bosildi: o'sha betga o'tiladi. */
  onGoPage: (page: number) => void;
}

function Result({
  attempt,
  onClose,
  onGoPage,
}: {
  attempt: AnswerAttemptDetail;
  onClose: () => void;
  onGoPage: (page: number) => void;
}) {
  const t = useTranslations("books.test.result");
  const format = useFormatter();
  const { correct, wrong, unanswered } = splitAttempt(attempt);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline gap-3">
        <p className="text-4xl font-bold tabular-nums" data-test-score>
          {attempt.score}
          <span className="text-muted text-2xl font-semibold"> / {attempt.total}</span>
        </p>
        <p className="text-muted text-sm">
          {t("percent", { percent: scorePercent(attempt.score, attempt.total) })}
          {" · "}
          {format.dateTime(new Date(attempt.created_at), {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>

      <section aria-label={t("wrongHeading", { count: wrong.length })}>
        <h3 className="text-sm font-semibold">{t("wrongHeading", { count: wrong.length })}</h3>
        {wrong.length === 0 ? (
          <p className="text-muted mt-1 text-sm">{t("allCorrect")}</p>
        ) : (
          <>
            <p className="text-muted mt-1 text-sm">{t("wrongHint")}</p>
            <ul className="mt-2 flex flex-col gap-1">
              {wrong.map((item) => (
                <li key={`${item.page}:${item.question}`}>
                  <button
                    type="button"
                    data-wrong-question={`${item.page}:${item.question}`}
                    onClick={() => onGoPage(item.page)}
                    className="border-border hover:bg-subtle flex min-h-11 w-full items-center justify-between gap-3 rounded-lg border px-3 text-left text-sm transition-colors"
                  >
                    <span className="font-medium">
                      {t("where", { page: item.page, question: item.question })}
                    </span>
                    <span className="text-muted">
                      {item.given === null
                        ? t("notAnswered")
                        : t("yourAnswer", { answer: item.given })}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
        {unanswered > 0 && wrong.length > 0 && (
          <p className="text-muted mt-2 text-xs">{t("unansweredNote", { count: unanswered })}</p>
        )}
      </section>

      {correct.length > 0 && (
        <section aria-label={t("correctHeading", { count: correct.length })}>
          <h3 className="text-sm font-semibold">
            {t("correctHeading", { count: correct.length })}
          </h3>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {correct.map((item) => (
              <li
                key={`${item.page}:${item.question}`}
                className="bg-success-soft text-success-soft-foreground rounded-md px-2 py-1 text-xs font-medium tabular-nums"
              >
                {t("short", { page: item.page, question: item.question })}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex justify-end">
        <Button variant="secondary" onClick={onClose}>
          {t("close")}
        </Button>
      </div>
    </div>
  );
}

function Loaded({
  bookId,
  attempt,
  onClose,
  onGoPage,
}: {
  bookId: string;
  attempt: AnswerAttemptDetail | { id: string };
  onClose: () => void;
  onGoPage: (page: number) => void;
}) {
  const t = useTranslations("books.test.result");
  const full = "items" in attempt;
  const query = useQuery({ ...bookQueries.testAttempt(bookId, attempt.id), enabled: !full });
  const detail = full ? attempt : query.data;

  if (detail) return <Result attempt={detail} onClose={onClose} onGoPage={onGoPage} />;
  if (query.isError) {
    return (
      <p role="alert" className="text-sm">
        {t("loadError")}
      </p>
    );
  }
  return (
    <p role="status" className="text-muted text-sm">
      {t("loading")}
    </p>
  );
}

/** «Tekshirish» natijasi: ball, xato savollar ro'yxati (bosilsa o'sha betga o'tadi) va to'g'rilari. */
export function TestResultDialog({ bookId, attempt, onClose, onGoPage }: TestResultDialogProps) {
  const t = useTranslations("books.test.result");
  return (
    <Dialog
      open={attempt !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t("title")}
    >
      {attempt && (
        <Loaded
          key={attempt.id}
          bookId={bookId}
          attempt={attempt}
          onClose={onClose}
          onGoPage={(page) => {
            onGoPage(page);
            onClose();
          }}
        />
      )}
    </Dialog>
  );
}
