"use client";

import { useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/hooks/useAuth";
import { useProgressRecorder } from "@/hooks/useProgressRecorder";
import { useSyncStatus } from "@/hooks/useSyncStatus";
import { Link } from "@/lib/i18n/navigation";
import { ROUTES } from "@/lib/utils/routes";
import { ExerciseCard, type ExerciseView } from "./ExerciseCard";

export type PracticeItem =
  { kind: "exercise"; exercise: ExerciseView } | { kind: "node"; id: string; node: ReactNode };

export interface PracticeSectionProps {
  topicId: string;
  items: PracticeItem[];
}

/**
 * Mashqlar bo'limi. Har javob `exercise_answered` hodisasi sifatida yoziladi (to'g'ri/xato va urinish
 * raqami bilan); holatni hisoblash `lib/progress` da. Mehmonga bloklamasdan "Saqlash uchun kiring"
 * taklifi ko'rsatiladi; kirganda natija oflayn navbat orqali yuboriladi.
 */
export function PracticeSection({ topicId, items }: PracticeSectionProps) {
  const t = useTranslations("topic.exercise");
  const { signedIn } = useAuth();
  const record = useProgressRecorder();
  const { synced } = useSyncStatus();
  const total = items.filter((item) => item.kind === "exercise").length;
  const [solved, setSolved] = useState<ReadonlySet<string>>(new Set());
  const [answered, setAnswered] = useState(false);
  // Shu ochilishdagi urinishlar: birinchi urinishda to'g'ri javob xatoni "takrorlash"dan chiqaradi.
  const attempts = useRef(new Map<string, number>());

  const handleChecked = (exerciseId: string, correct: boolean) => {
    const attempt = (attempts.current.get(exerciseId) ?? 0) + 1;
    attempts.current.set(exerciseId, attempt);
    setAnswered(true);
    if (correct) setSolved((current) => new Set(current).add(exerciseId));
    record({
      type: "exercise_answered",
      topicId,
      exerciseId,
      correct,
      attempt,
      totalExercises: total,
    });
  };

  let order = 0;
  return (
    <div className="flex flex-col gap-5">
      {items.map((item) =>
        item.kind === "exercise" ? (
          <div key={item.exercise.id} data-block-id={item.exercise.id}>
            <ExerciseCard exercise={item.exercise} order={++order} onChecked={handleChecked} />
          </div>
        ) : (
          <div key={item.id} data-block-id={item.id}>
            {item.node}
          </div>
        ),
      )}
      <div
        role="status"
        aria-live="polite"
        className="text-muted text-sm empty:hidden print:hidden"
      >
        {answered && (
          <p>
            {solved.size === total ? t("allDone") : t("progress", { done: solved.size, total })}
            {" · "}
            {signedIn ? (
              t(synced ? "saved" : "syncing")
            ) : (
              <>
                {t("saveInvite")}{" "}
                <Link href={ROUTES.login} className="text-link font-medium underline">
                  {t("saveInviteAction")}
                </Link>
              </>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
