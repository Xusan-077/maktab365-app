import { array, boolean, lazy, mixed, object, string, type Schema } from "yup";
import { SUMMARY_BLOCK_TYPES } from "@/lib/topic-materials/blocks";
import type { SummaryBlock, SummaryStatus } from "@/lib/topic-materials/types";

/** Chegaralar backend bilan bir xil (`docs/api-mavzu-materiallari.md`). */
export const SUMMARY_LIMITS = {
  blocks: 30,
  title: 120,
  text: 1200,
  lead: 80,
  item: 400,
  bullets: 12,
  label: 60,
  chip: 40,
  chips: 20,
} as const;
export const SLIDE_LIMITS = { alt: 200, note: 1000 } as const;

/**
 * Xabar kalitlari `admin.topic.errors.*` ga mos. Qoralama chala bo'lishi mumkin (avtosaqlash
 * to'xtamasin) — bo'sh maydonlar faqat nashr qilishda (`context.published`) xato; uzunlik
 * chegaralari doim tekshiriladi.
 */
const text = (max: number) => string().default("").max(max, "tooLong");
const filled = (max: number) =>
  text(max).when("$published", {
    is: true,
    then: (schema) => schema.trim().required("required"),
  });

const BLOCK_SCHEMAS: Record<SummaryBlock["type"], Schema> = {
  idea: object({
    type: string().required(),
    title: filled(SUMMARY_LIMITS.title),
    text: filled(SUMMARY_LIMITS.text),
  }),
  bullets: object({
    type: string().required(),
    items: array()
      .of(object({ lead: text(SUMMARY_LIMITS.lead), text: filled(SUMMARY_LIMITS.item) }))
      .max(SUMMARY_LIMITS.bullets, "tooMany")
      .when("$published", { is: true, then: (schema) => schema.min(1, "required") }),
  }),
  chips: object({
    type: string().required(),
    label: text(SUMMARY_LIMITS.label),
    items: array()
      .of(string().trim().required("required").max(SUMMARY_LIMITS.chip, "tooLong"))
      .max(SUMMARY_LIMITS.chips, "tooMany")
      .when("$published", { is: true, then: (schema) => schema.min(1, "required") }),
  }),
  teacher_note: object({ type: string().required(), text: filled(SUMMARY_LIMITS.text) }),
  example: object({ type: string().required(), text: filled(SUMMARY_LIMITS.text) }),
};

export const summarySchema = object({
  status: mixed<SummaryStatus>().oneOf(["draft", "published"]).required(),
  blocks: array()
    .of(
      lazy((value: { type?: string } | undefined) =>
        value?.type && (SUMMARY_BLOCK_TYPES as readonly string[]).includes(value.type)
          ? BLOCK_SCHEMAS[value.type as SummaryBlock["type"]]
          : mixed().test("type", "unknownType", () => false),
      ),
    )
    .max(SUMMARY_LIMITS.blocks, "tooMany")
    .when("$published", { is: true, then: (schema) => schema.min(1, "blocksRequired") }),
});

export const slidesSchema = object({
  slides: array().of(
    object({
      id: string().required(),
      alt: string().default("").max(SLIDE_LIMITS.alt, "tooLong"),
      note: string().nullable().default(null).max(SLIDE_LIMITS.note, "tooLong"),
      hidden: boolean().required(),
    }),
  ),
});
