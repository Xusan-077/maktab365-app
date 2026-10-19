import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { localize } from "@/lib/i18n/localize-blocks";
import { sectionDomId, type SectionKey, type TopicSectionGroup } from "@/lib/utils/topic-sections";
import type { TopicSummary } from "@/types/catalog";
import type { TopicBlock } from "@/types/topic";
import { Formula } from "./Formula";
import { NextTopic } from "./NextTopic";
import { PracticeSection, type PracticeItem } from "./PracticeSection";
import { SolvedExample } from "./SolvedExample";
import { WidgetHost } from "./WidgetHost";
import "katex/dist/katex.min.css";

type Block<T extends TopicBlock["type"]> = Extract<TopicBlock, { type: T }>;

export interface TopicRendererProps {
  topicId: string;
  bookId: string;
  groups: TopicSectionGroup[];
  locale: Locale;
  next: TopicSummary | null;
  /** "Keyingi mavzu" tugmasidan oldin chiziladigan qism (masalan, "Mavzuni o'qidim"). */
  beforeNext?: ReactNode;
}

function SectionShell({ sectionKey, children }: { sectionKey: SectionKey; children: ReactNode }) {
  const t = useTranslations("topic.sections");
  const id = sectionDomId(sectionKey);
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="flex flex-col gap-5">
      <h2 id={`${id}-title`} className="text-2xl font-bold tracking-tight">
        {t(sectionKey)}
      </h2>
      {children}
    </section>
  );
}

function RuleBlockView({ block, locale }: { block: Block<"rule">; locale: Locale }) {
  return (
    <div
      data-block-id={block.id}
      className="border-accent-400 bg-accent-soft flex flex-col gap-3 rounded-r-xl border-l-4 px-5 py-4 print:break-inside-avoid"
    >
      {block.title && (
        <h3 className="text-accent-soft-foreground text-lg font-semibold">
          {getLocalized(block.title, locale)}
        </h3>
      )}
      <p>{getLocalized(block.text, locale)}</p>
      {block.formula && <Formula tex={block.formula} className="text-xl" />}
    </div>
  );
}

function renderWidget(block: Block<"widget">, locale: Locale) {
  return (
    <div key={block.id} data-block-id={block.id}>
      <WidgetHost widget={localize(block, locale)} />
    </div>
  );
}

function renderSection(
  { key, blocks }: TopicSectionGroup,
  { topicId, locale }: Pick<TopicRendererProps, "topicId" | "locale">,
): ReactNode {
  switch (key) {
    case "goal":
      return blocks.map((block) =>
        block.type === "goal" ? (
          <p
            key={block.id}
            data-block-id={block.id}
            className="text-xl leading-9 font-medium text-balance"
          >
            {getLocalized(block.text, locale)}
          </p>
        ) : null,
      );

    case "explanation":
      return blocks.map((block) =>
        block.type === "explanation" ? (
          <div key={block.id} data-block-id={block.id} className="flex flex-col gap-2">
            {block.title && (
              <h3 className="text-lg font-semibold">{getLocalized(block.title, locale)}</h3>
            )}
            <p className="leading-8">{getLocalized(block.text, locale)}</p>
          </div>
        ) : null,
      );

    case "rule":
      return blocks.map((block) => {
        if (block.type === "rule") {
          return <RuleBlockView key={block.id} block={block} locale={locale} />;
        }
        return block.type === "widget" ? renderWidget(block, locale) : null;
      });

    case "example":
      return blocks.map((block) =>
        block.type === "example" ? (
          <div
            key={block.id}
            data-block-id={block.id}
            className="border-border bg-surface rounded-xl border p-4 sm:p-5 print:break-inside-avoid"
          >
            <SolvedExample
              title={block.title && getLocalized(block.title, locale)}
              steps={block.steps.map((step) => ({
                text: getLocalized(step.text, locale),
                formula: step.formula && <Formula tex={step.formula} className="mt-1 text-lg" />,
              }))}
            />
          </div>
        ) : null,
      );

    case "exercise": {
      const items = blocks.flatMap<PracticeItem>((block) => {
        if (block.type === "exercise") {
          return [{ kind: "exercise", exercise: localize(block, locale) }];
        }
        return block.type === "widget"
          ? [{ kind: "node", id: block.id, node: <WidgetHost widget={localize(block, locale)} /> }]
          : [];
      });
      return <PracticeSection topicId={topicId} items={items} />;
    }

    case "summary":
      return blocks.map((block) =>
        block.type === "summary" ? (
          <ul key={block.id} data-block-id={block.id} className="flex flex-col gap-3">
            {block.points.map((point, index) => (
              <li key={index} className="flex gap-3 leading-8">
                <span aria-hidden className="bg-primary-600 mt-3 size-1.5 shrink-0 rounded-full" />
                <span>{getLocalized(point, locale)}</span>
              </li>
            ))}
          </ul>
        ) : null,
      );
  }
}

/**
 * `TopicBlock[]` ni belgilangan tartibda chizadi: maqsad → tushuntirish → qoida/formula → yechilgan
 * misol → mashq → xulosa → keyingi mavzu. Formulalar serverda KaTeX bilan chiziladi; faqat
 * interaktiv qismlar (misol, mashq, widget) client'ga tushadi.
 */
export function TopicRenderer({
  topicId,
  bookId,
  groups,
  locale,
  next,
  beforeNext,
}: TopicRendererProps) {
  return (
    <div className="flex flex-col gap-12">
      {groups.map((group) => (
        <SectionShell key={group.key} sectionKey={group.key}>
          {renderSection(group, { topicId, locale })}
        </SectionShell>
      ))}
      {beforeNext}
      <NextTopic bookId={bookId} next={next} locale={locale} />
    </div>
  );
}
