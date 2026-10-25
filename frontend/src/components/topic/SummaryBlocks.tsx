import { Lightbulb } from "lucide-react";
import { useTranslations } from "next-intl";
import { hasContent } from "@/lib/topic-materials/blocks";
import type { SummaryBlock } from "@/lib/topic-materials/types";
import { cn } from "@/lib/utils/cn";

/** Matnni qatorlarga bo'lib chiqaradi (erkin HTML yo'q — faqat matn). */
function Paragraphs({ text, className }: { text: string; className?: string }) {
  return text
    .split(/\n{2,}/)
    .filter((part) => part.trim())
    .map((part, index) => (
      <p key={index} className={cn("whitespace-pre-line", className)}>
        {part.trim()}
      </p>
    ));
}

function Block({ block }: { block: SummaryBlock }) {
  const t = useTranslations("topic.summary");
  switch (block.type) {
    case "idea":
      return (
        <section
          data-block="idea"
          className="bg-ds-accent-tint text-ds-ink rounded-ds flex gap-3 p-4"
        >
          <Lightbulb className="text-ds-accent-ink mt-0.5 size-5 shrink-0" aria-hidden />
          <div className="flex min-w-0 flex-col gap-1.5">
            {block.title.trim() && (
              <h3 className="text-ds-accent-ink text-[0.9375rem] font-bold">{block.title}</h3>
            )}
            <Paragraphs text={block.text} className="text-sm leading-relaxed" />
          </div>
        </section>
      );
    case "bullets": {
      const items = block.items.filter((item) => item.lead.trim() || item.text.trim());
      return (
        <ul data-block="bullets" className="text-ds-ink flex flex-col gap-2 pl-1 text-sm">
          {items.map((item, index) => (
            <li key={index} className="flex gap-2.5 leading-relaxed">
              <span aria-hidden className="bg-ds-accent mt-2 size-1.5 shrink-0 rounded-full" />
              <span>
                {item.lead.trim() && (
                  <strong className="text-ds-accent-ink font-bold">{item.lead}</strong>
                )}
                {item.lead.trim() && item.text.trim() && " — "}
                {item.text}
              </span>
            </li>
          ))}
        </ul>
      );
    }
    case "chips":
      return (
        <section data-block="chips" className="flex flex-col gap-2">
          {block.label.trim() && (
            <h3 className="text-ds-muted text-xs font-bold tracking-wide uppercase">
              {block.label}
            </h3>
          )}
          <ul className="flex flex-wrap gap-1.5">
            {block.items
              .filter((item) => item.trim())
              .map((item, index) => (
                <li
                  key={index}
                  className="border-ds-line bg-ds-surface text-ds-ink rounded-full border px-3 py-1 text-[0.8125rem] font-semibold"
                >
                  {item}
                </li>
              ))}
          </ul>
        </section>
      );
    case "teacher_note":
      return (
        <aside
          data-block="teacher_note"
          aria-label={t("teacherNote")}
          className="border-ds-warn-border bg-ds-warn-bg text-ds-warn-ink rounded-ds border-2 border-dashed p-4"
        >
          <p className="mb-1.5 text-xs font-extrabold tracking-wider uppercase">
            {t("teacherNote")}
          </p>
          <Paragraphs text={block.text} className="text-sm leading-relaxed" />
        </aside>
      );
    case "example":
      return (
        <section
          data-block="example"
          className="border-ds-line bg-ds-canvas text-ds-ink rounded-ds border-l-4 p-4"
        >
          <p className="text-ds-muted mb-1.5 text-xs font-extrabold tracking-wider uppercase">
            {t("example")}
          </p>
          <Paragraphs text={block.text} className="text-sm leading-relaxed" />
        </section>
      );
    default:
      // Noma'lum (yangi versiyadagi) blok tipi — jim o'tkaziladi.
      return null;
  }
}

/**
 * Mavzu xulosasi: tipli bloklar (`idea`, `bullets`, `chips`, `teacher_note`, `example`), erkin HTML
 * yo'q. O'qish oynasidagi mavzu paneli va admin «Oldindan ko'rish» shu komponentdan foydalanadi.
 * Bo'sh bloklar chiqmaydi.
 */
export function SummaryBlocks({
  blocks,
  className,
}: {
  blocks: readonly SummaryBlock[];
  className?: string;
}) {
  return (
    <div className={cn("font-ui flex flex-col gap-4", className)} data-testid="summary-blocks">
      {blocks.filter(hasContent).map((block, index) => (
        <Block key={index} block={block} />
      ))}
    </div>
  );
}
