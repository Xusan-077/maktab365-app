import { describe, expect, it } from "vitest";
import { createBookSchema, createTopicSchema } from "./admin";

const validBook = {
  slug: "fizika-7",
  subject: "fizika",
  grade: "7",
  title: { uz: "Fizika" },
  author: "Mualliflar",
  edition: "1-nashr",
  year: "2022",
};

describe("admin validation", () => {
  it("to'g'ri kitobni qabul qiladi va yilni songa aylantiradi", async () => {
    const value = await createBookSchema().validate(validBook);
    expect(value.year).toBe(2022);
    expect(value.title.ru).toBe("");
  });

  it.each([
    ["slug", "Fizika 7"],
    ["slug", "-fizika"],
    ["slug", "fizika--7"],
    ["year", "1800"],
    ["year", "abc"],
    ["author", "  "],
  ])("%s=%j ni rad etadi", async (field, value) => {
    await expect(createBookSchema().validate({ ...validBook, [field]: value })).rejects.toThrow();
  });

  it("mavzu bloklari JSON massiv bo'lishi kerak", async () => {
    const base = { slug: "viyet", title: { uz: "Viyet" } };
    await expect(createTopicSchema().validate({ ...base, blocks: "[]" })).resolves.toBeDefined();
    await expect(createTopicSchema().validate({ ...base, blocks: "{}" })).rejects.toThrow();
    await expect(createTopicSchema().validate({ ...base, blocks: "[" })).rejects.toThrow();
  });
});
