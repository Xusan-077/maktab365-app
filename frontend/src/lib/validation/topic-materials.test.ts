import { describe, expect, it } from "vitest";
import { ValidationError } from "yup";
import { emptyBlock } from "@/lib/topic-materials/blocks";
import type { SummaryBlock } from "@/lib/topic-materials/types";
import { SUMMARY_LIMITS, slidesSchema, summarySchema } from "./topic-materials";

const validate = (blocks: SummaryBlock[], published: boolean) =>
  summarySchema.validate(
    { status: published ? "published" : "draft", blocks },
    { abortEarly: false, context: { published } },
  );

const errorsOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
    return [];
  } catch (error) {
    if (!(error instanceof ValidationError)) throw error;
    return error.inner.map((inner) => `${inner.path}:${inner.message}`);
  }
};

describe("summarySchema", () => {
  it("qoralama chala bo'lishi mumkin (bo'sh bloklar ham)", async () => {
    expect(await errorsOf(validate([emptyBlock("idea"), emptyBlock("chips")], false))).toEqual([]);
    expect(await errorsOf(validate([], false))).toEqual([]);
  });

  it("nashrda bo'sh maydonlar va bloksiz xulosa — xato", async () => {
    expect(await errorsOf(validate([], true))).toEqual(["blocks:blocksRequired"]);
    expect(await errorsOf(validate([emptyBlock("idea")], true))).toEqual([
      "blocks[0].title:required",
      "blocks[0].text:required",
    ]);
    expect(await errorsOf(validate([emptyBlock("chips")], true))).toEqual([
      "blocks[0].items:required",
    ]);
  });

  it("uzunlik chegarasi qoralamada ham tekshiriladi", async () => {
    const long = "x".repeat(SUMMARY_LIMITS.text + 1);
    expect(await errorsOf(validate([{ type: "example", text: long }], false))).toEqual([
      "blocks[0].text:tooLong",
    ]);
  });

  it("to'ldirilgan bloklar nashrga yaroqli", async () => {
    const blocks: SummaryBlock[] = [
      { type: "idea", title: "G‘oya", text: "Matn" },
      { type: "bullets", items: [{ lead: "", text: "Band" }] },
      { type: "chips", label: "", items: ["a", "b"] },
      { type: "teacher_note", text: "Eslatma" },
      { type: "example", text: "Misol" },
    ];
    expect(await errorsOf(validate(blocks, true))).toEqual([]);
  });
});

describe("slidesSchema", () => {
  it("alt va eslatma chegaralari", async () => {
    const slide = { id: "s1", alt: "x".repeat(201), note: null, hidden: false };
    expect(
      await errorsOf(slidesSchema.validate({ slides: [slide] }, { abortEarly: false })),
    ).toEqual(["slides[0].alt:tooLong"]);
  });
});
