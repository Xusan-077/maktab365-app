import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/Card";
import { getTopicById } from "@/lib/api/server";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import type { Topic, TopicBlock, TopicBlockType } from "@/types/topic";
import { SHOWCASE_TOPIC_ID } from "./ids";
import { Section } from "./Section";

/** Mavzu tuzilmasi: 7 ta blok turi shu tartibda ko'rsatiladi. */
const BLOCK_ORDER = [
  "goal",
  "explanation",
  "rule",
  "example",
  "exercise",
  "summary",
  "widget",
] as const satisfies readonly TopicBlockType[];

type BlockOf<T extends TopicBlockType> = Extract<TopicBlock, { type: T }>;

function findBlock<T extends TopicBlockType>(topic: Topic, type: T): BlockOf<T> | undefined {
  return topic.blocks.find((block): block is BlockOf<T> => block.type === type);
}

const firstSentence = (text: string) => text.split(/(?<=[.!?])\s/)[0] ?? text;

/** Haqiqiy mavzu (API'dan) 7 ta blok tuzilmasi ko'rinishida. */
export async function TopicAnatomy({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "home.anatomy" });
  // Namuna mavzu bosh sahifaning ixtiyoriy qismi: backend o'chiq/mavzu yo'q bo'lsa bo'lim chizilmaydi.
  const topic = await getTopicById(SHOWCASE_TOPIC_ID).catch(() => null);
  if (!topic) return null;
  const text = (value: Parameters<typeof getLocalized>[0]) => getLocalized(value, locale);

  const goal = findBlock(topic, "goal");
  const explanation = findBlock(topic, "explanation");
  const rule = findBlock(topic, "rule");
  const example = findBlock(topic, "example");
  const exercise = findBlock(topic, "exercise");
  const summary = findBlock(topic, "summary");

  const content: Record<(typeof BLOCK_ORDER)[number], ReactNode> = {
    goal: goal && <p>{text(goal.text)}</p>,
    explanation: explanation && <p>{firstSentence(text(explanation.text))}</p>,
    rule: rule && (
      <div className="bg-accent-soft text-accent-soft-foreground rounded-lg px-3 py-2">
        {rule.title && <p className="text-sm font-semibold">{text(rule.title)}</p>}
        {rule.formula && <p className="text-lg font-semibold">{rule.formula}</p>}
      </div>
    ),
    example: example && (
      <div className="flex flex-col gap-1">
        {example.title && <p className="font-medium">{text(example.title)}</p>}
        <ol className="text-muted flex flex-col gap-0.5 text-sm">
          {example.steps.flatMap((step, index) =>
            step.formula ? [<li key={index}>{step.formula}</li>] : [],
          )}
        </ol>
      </div>
    ),
    exercise: exercise && (
      <div className="flex flex-col gap-2">
        <p className="font-medium">{text(exercise.question)}</p>
        {exercise.answerType === "choice" && (
          <ul className="flex flex-wrap gap-2">
            {exercise.options.map((option, index) => (
              <li
                key={index}
                className="border-border bg-surface rounded-full border px-3 py-1 text-sm"
              >
                {text(option)}
              </li>
            ))}
          </ul>
        )}
        <p className="text-muted text-sm">{t("exerciseTypes")}</p>
      </div>
    ),
    summary: summary && (
      <ul className="flex list-disc flex-col gap-1 pl-5">
        {summary.points.map((point, index) => (
          <li key={index}>{text(point)}</li>
        ))}
      </ul>
    ),
    widget: <p>{t("widgetText")}</p>,
  };

  return (
    <Section
      id="topic-anatomy"
      title={t("title")}
      description={t("subtitle", { book: t("book"), topic: text(topic.title) })}
    >
      <ol className="flex flex-col gap-3">
        {BLOCK_ORDER.map((type, index) => (
          <li key={type}>
            <Card className="grid gap-3 p-4 sm:grid-cols-[11rem_1fr] sm:gap-6 sm:p-5">
              <div className="flex items-center gap-3 sm:items-start">
                <span
                  aria-label={t("stepOf", { step: index + 1 })}
                  className="bg-primary-600 inline-flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
                >
                  {index + 1}
                </span>
                <h3 className="text-base font-semibold">{t(`blocks.${type}`)}</h3>
              </div>
              <div className="text-foreground text-base">{content[type]}</div>
            </Card>
          </li>
        ))}
      </ol>
    </Section>
  );
}
