import { describe, expect, it } from "vitest";
import { goalSchema } from "./goal";

const errors = async (values: object) => {
  try {
    await goalSchema.validate(values, { abortEarly: false });
    return [];
  } catch (error) {
    return (error as { errors: string[] }).errors;
  }
};

describe("goalSchema", () => {
  it("bo'sh yoki bo'shliqdan iborat maqsadni rad etadi", async () => {
    expect(await errors({ title: "   " })).toEqual(["titleRequired"]);
  });

  it("juda uzun maqsadni rad etadi", async () => {
    expect(await errors({ title: "a".repeat(121) })).toEqual(["titleTooLong"]);
    expect(await errors({ title: "Viyet teoremasini takrorlash" })).toEqual([]);
  });
});
