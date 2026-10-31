import { describe, expect, it } from "vitest";
import { formValuesToInput, newQuizValues } from "@/lib/quizzes/form";
import { quizFormSchema, type QuizFormValues } from "./quiz";

const valid = (): QuizFormValues => ({
  ...newQuizValues(),
  title: "Zakovat",
  questions: [
    {
      text: "2 + 2?",
      image: "",
      imageUrl: null,
      options: [
        { text: "3", isCorrect: false },
        { text: "4", isCorrect: true },
      ],
    },
  ],
});

const errorOf = async (values: QuizFormValues) => {
  try {
    await quizFormSchema.validate(values, { abortEarly: true });
    return null;
  } catch (error) {
    return (error as { message: string }).message;
  }
};

describe("quizFormSchema", () => {
  it("to'g'ri forma o'tadi", async () => {
    expect(await errorOf(valid())).toBeNull();
  });

  it("sarlavha majburiy", async () => {
    expect(await errorOf({ ...valid(), title: "  " })).toBe("titleRequired");
  });

  it("kamida 1 savol", async () => {
    expect(await errorOf({ ...valid(), questions: [] })).toBe("questionsMin");
  });

  it("savolda kamida 2 variant", async () => {
    const values = valid();
    values.questions[0].options = [{ text: "4", isCorrect: true }];
    expect(await errorOf(values)).toBe("optionsMin");
  });

  it("aynan bitta to'g'ri javob", async () => {
    const none = valid();
    none.questions[0].options[1].isCorrect = false;
    expect(await errorOf(none)).toBe("correctRequired");
    const two = valid();
    two.questions[0].options[0].isCorrect = true;
    expect(await errorOf(two)).toBe("correctRequired");
  });
});

describe("formValuesToInput", () => {
  it("bo'sh kategoriya/taymer null, matn kesiladi", () => {
    const input = formValuesToInput({ ...valid(), title: "  Test  ", timePerQuestion: 0 });
    expect(input.title).toBe("Test");
    expect(input.category_id).toBeNull();
    expect(input.time_per_question).toBeNull();
    expect(input.questions[0].options[1].is_correct).toBe(true);
  });

  it("taymer qiymati saqlanadi", () => {
    expect(formValuesToInput({ ...valid(), timePerQuestion: 30 }).time_per_question).toBe(30);
  });
});
