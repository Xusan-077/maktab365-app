"use client";

import { CircleCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { useProgressRecorder } from "@/hooks/useProgressRecorder";
import { useTopicProgress } from "@/hooks/useProgress";

/** "Mavzuni o'qidim": oxirigacha aylantirmasdan ham mavzuni o'qilgan deb belgilash (mashq holatidan alohida). */
export function MarkReadButton({ topicId }: { topicId: string }) {
  const t = useTranslations("topic.markRead");
  const record = useProgressRecorder();
  const { data } = useTopicProgress(topicId);

  if (data?.readStatus === "completed") {
    return (
      <p
        role="status"
        className="text-success present:hidden flex items-center gap-2 font-medium print:hidden"
      >
        <CircleCheck className="size-5 shrink-0" aria-hidden />
        {t("done")}
      </p>
    );
  }
  return (
    <div className="present:hidden print:hidden">
      <Button
        variant="secondary"
        onClick={() => record({ type: "topic_read", topicId, source: "manual" })}
      >
        {t("action")}
      </Button>
    </div>
  );
}
