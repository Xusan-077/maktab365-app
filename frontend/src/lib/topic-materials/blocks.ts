/** Xulosa bloklari: API javobini tekshirish (noma'lum tip jim tashlanadi) va bo'sh blok (sof funksiyalar). */

import type { SummaryBlock, SummaryBlockType } from "./types";

export const SUMMARY_BLOCK_TYPES = [
  "idea",
  "bullets",
  "chips",
  "teacher_note",
  "example",
] as const satisfies readonly SummaryBlockType[];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const str = (value: unknown) => (typeof value === "string" ? value : "");

/** Bitta blok: tanish tip va to'g'ri shakl bo'lsa normallashgan nusxa, aks holda `null`. */
export function parseBlock(value: unknown): SummaryBlock | null {
  if (!isRecord(value)) return null;
  switch (value.type) {
    case "idea":
      return { type: "idea", title: str(value.title), text: str(value.text) };
    case "bullets":
      return {
        type: "bullets",
        items: (Array.isArray(value.items) ? value.items : [])
          .filter(isRecord)
          .map((item) => ({ lead: str(item.lead), text: str(item.text) })),
      };
    case "chips":
      return {
        type: "chips",
        label: str(value.label),
        items: (Array.isArray(value.items) ? value.items : []).filter(
          (item): item is string => typeof item === "string",
        ),
      };
    case "teacher_note":
      return { type: "teacher_note", text: str(value.text) };
    case "example":
      return { type: "example", text: str(value.text) };
    default:
      return null;
  }
}

/** Backend'dan kelgan ro'yxat: noma'lum (yangi versiyadagi) tiplar jim o'tkazib yuboriladi. */
export function parseBlocks(value: unknown): SummaryBlock[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const block = parseBlock(item);
    return block ? [block] : [];
  });
}

/** Muharrirdagi «+ Blok qo'shish»: tipga mos bo'sh blok. */
export function emptyBlock(type: SummaryBlockType): SummaryBlock {
  switch (type) {
    case "idea":
      return { type, title: "", text: "" };
    case "bullets":
      return { type, items: [{ lead: "", text: "" }] };
    case "chips":
      return { type, label: "", items: [] };
    case "teacher_note":
    case "example":
      return { type, text: "" };
  }
}

/** Ko'rsatishga arziydigan blok (preview va o'quvchi tomonida bo'sh qoralama bloklar chiqmaydi). */
export function hasContent(block: SummaryBlock): boolean {
  switch (block.type) {
    case "idea":
      return Boolean(block.title.trim() || block.text.trim());
    case "bullets":
      return block.items.some((item) => item.lead.trim() || item.text.trim());
    case "chips":
      return block.items.some((item) => item.trim());
    default:
      return Boolean(block.text.trim());
  }
}
