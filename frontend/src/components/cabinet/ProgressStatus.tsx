import { useTranslations } from "next-intl";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import type { ExerciseStatus, Progress, ReadStatus } from "@/types/progress";

const READ_VARIANT: Record<ReadStatus, BadgeVariant> = {
  none: "neutral",
  started: "primary",
  completed: "success",
};

const EXERCISE_VARIANT: Record<ExerciseStatus, BadgeVariant> = {
  none: "neutral",
  in_progress: "primary",
  completed: "success",
};

/**
 * "Mavzuni o'qidim" va "Mashqlardan o'tdim" — ikki alohida holat; ikkalasi ham doim ko'rsatiladi,
 * shunda o'qigan-u mashq qilmagan (yoki aksincha) mavzu aniq ko'rinadi.
 */
export function ProgressStatus({
  progress,
}: {
  progress: Pick<Progress, "readStatus" | "exerciseStatus" | "mistakes">;
}) {
  const t = useTranslations("cabinet.status");
  return (
    <ul className="flex flex-wrap gap-1.5">
      <li>
        <Badge variant={READ_VARIANT[progress.readStatus]}>
          {t(`read.${progress.readStatus}`)}
        </Badge>
      </li>
      <li>
        <Badge variant={EXERCISE_VARIANT[progress.exerciseStatus]}>
          {t(`exercise.${progress.exerciseStatus}`)}
        </Badge>
      </li>
      {progress.mistakes.length > 0 && (
        <li>
          <Badge variant="danger">{t("mistakes", { count: progress.mistakes.length })}</Badge>
        </li>
      )}
    </ul>
  );
}
