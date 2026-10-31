import { describe, expect, it } from "vitest";
import { questionSchema } from "@/lib/validation/questions";
import { moveItem, toQuestionForm, toQuestionInput } from "./questions";
import type { AdminQuestion } from "./types";

const question: AdminQuestion = {
  id: "q1",
  topic: "t1",
  text: { uz: "Savol", ru: "Вопрос" },
  image: "",
  image_url: null,
  difficulty: "hard",
  order: 0,
  is_active: false,
  options: [
    { id: "o2", text: { uz: "B" }, is_correct: true, order: 1 },
    { id: "o1", text: { uz: "A" }, is_correct: false, order: 0 },
    { id: "o3", text: { uz: "C" }, is_correct: false, order: 2 },
    { id: "o4", text: { uz: "D", en: "D!" }, is_correct: false, order: 3 },
  ],
  created_at: "2026-10-27T00:00:00Z",
  updated_at: "2026-10-27T00:00:00Z",
};

describe("question form mapping", () => {
  it("round-trips an API question (options by order, radio = correct index)", () => {
    const form = toQuestionForm(question);
    expect(form.correct).toBe("1");
    expect(form.options.map((o) => o.text.uz)).toEqual(["A", "B", "C", "D"]);
    expect(form.text).toEqual({ uz: "Savol", ru: "Вопрос", en: "" });
    const input = toQuestionInput(form);
    expect(input.is_active).toBe(false);
    expect(input.options.map((o) => o.is_correct)).toEqual([false, true, false, false]);
    expect(input.options[3].text).toEqual({ uz: "D", en: "D!" });
    expect(input.text).toEqual({ uz: "Savol", ru: "Вопрос" });
  });

  it("new question has 4 empty options and no answer", () => {
    const form = toQuestionForm();
    expect(form.options).toHaveLength(4);
    expect(form.correct).toBe("");
  });
});

describe("questionSchema", () => {
  const valid = () => ({ ...toQuestionForm(question) });

  it("accepts a complete question", () => {
    expect(questionSchema.isValidSync(valid())).toBe(true);
  });

  it("requires an answer and every uz text", async () => {
    const values = { ...valid(), correct: "" };
    await expect(questionSchema.validate(values)).rejects.toThrow("correctRequired");
    const empty = valid();
    empty.options[2] = { text: { uz: " ", ru: "", en: "" } };
    await expect(questionSchema.validateAt("options[2].text.uz", empty)).rejects.toThrow(
      "required",
    );
  });

  it("limits text length", async () => {
    const values = valid();
    values.text = { uz: "x".repeat(1001), ru: "", en: "" };
    await expect(questionSchema.validateAt("text.uz", values)).rejects.toThrow("tooLong");
  });
});

describe("moveItem", () => {
  it("moves without mutating", () => {
    const items = ["a", "b", "c"];
    expect(moveItem(items, 2, 0)).toEqual(["c", "a", "b"]);
    expect(items).toEqual(["a", "b", "c"]);
  });
});
