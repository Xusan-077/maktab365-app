"use client";

import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAppPaths } from "@/hooks/useAppPaths";
import { useTopicContext } from "@/hooks/useTopicContext";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { Link } from "@/lib/i18n/navigation";

export interface TopicRowProps {
  topicId: string;
  /** Havolaga qo'shiladigan hash (masalan, `#section-exercise`). */
  hash?: string;
  /** Sarlavha ostidagi qo'shimcha qator (holat belgilari). */
  children?: ReactNode;
  /** O'ng tomondagi amal; mavzu sarlavhasi tugma `aria-label`i uchun beriladi. */
  action?: (topicTitle: string) => ReactNode;
}

/** Mavzu id'si bo'yicha: sarlavha havolasi, "Fan · Sinf" qatori va ixtiyoriy amal. */
export function TopicRow({ topicId, hash, children, action }: TopicRowProps) {
  const locale = useLocale() as Locale;
  const paths = useAppPaths();
  const tg = useTranslations("home.grades");
  const { topic, subject, book, isError } = useTopicContext(topicId);

  if (isError) return null;
  if (!topic) return <Skeleton className="h-10 w-full max-w-xs" />;

  const title = getLocalized(topic.title, locale);
  const context = [
    subject && getLocalized(subject.name, locale),
    book && tg("chip", { grade: book.grade }),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-1.5">
        <Link
          href={`${paths.topic(topic.bookId, topic.id)}${hash ?? ""}`}
          className="text-link rounded-md font-medium hover:underline"
        >
          {title}
        </Link>
        {context && <p className="text-muted text-sm">{context}</p>}
        {children}
      </div>
      {action?.(title)}
    </div>
  );
}
