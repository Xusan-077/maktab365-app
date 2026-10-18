import { describe, expect, it } from "vitest";
import { profileSchema, toProfileInput } from "./profile";

const errors = async (values: object) => {
  try {
    await profileSchema.validate(values, { abortEarly: false });
    return [];
  } catch (error) {
    return (error as { errors: string[] }).errors;
  }
};

describe("profileSchema", () => {
  it("o'quvchi: ism va sinf kerak, fanlar kerak emas", async () => {
    expect(await errors({ role: "student", name: " ", grade: undefined })).toEqual(
      expect.arrayContaining(["nameRequired", "gradeRequired"]),
    );
    expect(await errors({ role: "student", name: "Aziza", grade: 9 })).toEqual([]);
  });

  it("o'qituvchi: kamida bitta fan va sinf kerak", async () => {
    expect(await errors({ role: "teacher", name: "Ali", subjects: [], grades: [] })).toEqual(
      expect.arrayContaining(["subjectsRequired", "gradesRequired"]),
    );
    expect(
      await errors({ role: "teacher", name: "Ali", subjects: ["math"], grades: [9, 10] }),
    ).toEqual([]);
  });

  it("noma'lum rolni rad etadi", async () => {
    expect(await errors({ role: "admin", name: "X" })).toContain("roleRequired");
  });
});

describe("toProfileInput", () => {
  it("rolga mos maydonlarni oladi", () => {
    expect(
      toProfileInput({
        role: "student",
        name: " Aziza ",
        grade: 9,
        subjects: ["math"],
        grades: [],
      }),
    ).toEqual({ role: "student", name: "Aziza", grade: 9 });
    expect(
      toProfileInput({ role: "teacher", name: "Ali", subjects: ["math"], grades: [10, 9] }),
    ).toEqual({ role: "teacher", name: "Ali", subjects: ["math"], grades: [9, 10] });
  });
});
