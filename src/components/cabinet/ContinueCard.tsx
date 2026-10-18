"use client";

import { useLocale, useTranslations } from "next-intl";
import { buttonVariants } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAppPaths } from "@/hooks/useAppPaths";
import { useTopicContext } from "@/hooks/useTopicContext";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { Link } from "@/lib/i18n/navigation";
import { describeBlock } from "@/lib/utils/topic-sections";
import type { Progress } from "@/types/progress";
import { ProgressStatus } from "./ProgressStatus";

/** Oxirgi boshlangan mavzu: fan, mavzu, oxirgi o'qilgan qism va "Davom ettirish" (lastBlockId'ga olib boradi). */
export function ContinueCard({ progress }: { progress: Progress }) {
  const t = useTranslations("cabinet.continue");
  const ts = useTranslations("topic.sections");
  const locale = useLocale() as Locale;
  const paths = useAppPaths();
  const { topic, subject } = useTopicContext(progress.topicId);

  if (!topic) return <Skeleton className="h-44 w-full rounded-xl" />;

  const topicTitle = getLocalized(topic.title, locale);
  const description = progress.lastBlockId
    ? describeBlock(topic.blocks, progress.lastBlockId)
    : undefined;

  let part = t("partStart");
  if (description) {
    const section = ts(description.section);
    if (description.exerciseOrder) {
      part = t("partExercise", { section, order: description.exerciseOrder });
    } else if (description.title) {
      part = t("partWithTitle", { section, title: getLocalized(description.title, locale) });
    } else {
      part = section;
    }
  }

  const href =
    description && progress.lastBlockId
      ? paths.topicBlock(topic.bookId, topic.id, progress.lastBlockId)
      : paths.topic(topic.bookId, topic.id);

  return (
    <section
      aria-labelledby="continue-title"
      className="border-border bg-surface flex flex-col gap-4 rounded-xl border p-6"
    >
      <div className="flex flex-col gap-1.5">
        <h2 id="continue-title" className="text-2xl font-semibold tracking-tight text-balance">
          {subject
            ? t("title", { subject: getLocalized(subject.name, locale), topic: topicTitle })
            : t("titleNoSubject", { topic: topicTitle })}
        </h2>
        <p className="text-muted">{t("lastPart", { part })}</p>
      </div>
      <ProgressStatus progress={progress} />
      <div>
        <Link
          href={href}
          aria-label={t("actionLabel", { topic: topicTitle })}
          className={buttonVariants({ size: "lg" })}
        >
          {t("action")}
        </Link>
      </div>
    </section>
  );
}
