import type { LocalizedText } from "@/types/i18n";
import type { TopicBlock, WidgetKind } from "@/types/topic";

/** Mavzu sahifasidagi bo'limlar tartibi (7-bo'lim — "Keyingi mavzu" — alohida chiziladi). */
export const SECTION_KEYS = [
  "goal",
  "explanation",
  "rule",
  "example",
  "exercise",
  "summary",
] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

/** Widget qaysi bo'lim ichida chiziladi: tushuntiruvchi — qoida yonida, til mashqi — mashqlar ichida. */
export const WIDGET_SECTION: Record<WidgetKind, SectionKey> = {
  "quadratic-graph": "rule",
  "choice-explain": "exercise",
  "geometry-points": "rule",
  timeline: "rule",
};

export function sectionOf(block: TopicBlock): SectionKey {
  return block.type === "widget" ? WIDGET_SECTION[block.kind] : block.type;
}

export const sectionDomId = (key: SectionKey) => `section-${key}`;

export interface TopicSectionGroup {
  key: SectionKey;
  blocks: TopicBlock[];
}

/** Bloklarni bo'limlarga ajratadi: tartib `SECTION_KEYS` bo'yicha, bo'lim ichida — asl tartibda; bo'sh bo'limlar tushib qoladi. */
export function groupBlocks(blocks: TopicBlock[]): TopicSectionGroup[] {
  return SECTION_KEYS.map((key) => ({
    key,
    blocks: blocks.filter((block) => sectionOf(block) === key),
  })).filter((group) => group.blocks.length > 0);
}

export interface BlockDescription {
  section: SectionKey;
  /** Blokning o'z sarlavhasi (tushuntirish, qoida, misol). */
  title?: LocalizedText;
  /** Mashq bloki bo'lsa, mavzudagi mashqlar ichidagi tartib raqami (1 dan). */
  exerciseOrder?: number;
}

/** Oxirgi o'qilgan blokni foydalanuvchiga ko'rsatish uchun tasvirlaydi; blok topilmasa `undefined`. */
export function describeBlock(blocks: TopicBlock[], blockId: string): BlockDescription | undefined {
  const block = blocks.find((item) => item.id === blockId);
  if (!block) return undefined;
  const section = sectionOf(block);
  if (block.type === "exercise") {
    const exerciseOrder =
      blocks.filter((item) => item.type === "exercise").findIndex((item) => item.id === blockId) +
      1;
    return { section, exerciseOrder };
  }
  if ("title" in block && block.title) return { section, title: block.title };
  return { section };
}
