import { describe, expect, it } from "vitest";
import { createSupportSchema, SUPPORT_MESSAGE_MAX, SUPPORT_MESSAGE_MIN } from "./support";

const errors = async (schema: ReturnType<typeof createSupportSchema>, values: object) => {
  try {
    await schema.validate(values, { abortEarly: false });
    return [];
  } catch (error) {
    return (error as { errors: string[] }).errors;
  }
};

const valid = {
  kind: "question",
  email: "ali@example.com",
  message: "Bu yetarlicha uzun xabar.",
  website: "",
};

describe("createSupportSchema (mehmon)", () => {
  const schema = createSupportSchema({ emailRequired: true });

  it("to'g'ri qiymatlar o'tadi", async () => {
    expect(await errors(schema, valid)).toEqual([]);
  });

  it("bo'sh forma: tur, email va xabar so'raladi", async () => {
    expect(await errors(schema, { kind: "", email: "", message: "", website: "" })).toEqual(
      expect.arrayContaining(["kindRequired", "emailRequired", "messageRequired"]),
    );
  });

  it("noto'g'ri email", async () => {
    expect(await errors(schema, { ...valid, email: "ali@" })).toEqual(["emailInvalid"]);
  });

  it("noma'lum tur rad etiladi", async () => {
    expect(await errors(schema, { ...valid, kind: "idea" })).toEqual(["kindRequired"]);
  });

  it("xabar uzunligi chegaralari (bo'sh joylar hisobga olinmaydi)", async () => {
    // Haqiqiy so'zlar (ma'nosiz matn tekshiruvi alohida — support-quality.test.ts).
    const words = (length: number) => "Kitobda xato bor ".repeat(200).slice(0, length);
    const short = words(SUPPORT_MESSAGE_MIN - 1).trim();
    expect(await errors(schema, { ...valid, message: `   ${short}   ` })).toEqual([
      "messageTooShort",
    ]);
    expect(await errors(schema, { ...valid, message: words(SUPPORT_MESSAGE_MIN + 2) })).toEqual([]);
    expect(
      await errors(schema, { ...valid, message: `${words(SUPPORT_MESSAGE_MAX)}xato bor` }),
    ).toEqual(["messageTooLong"]);
  });
});

describe("createSupportSchema (kirgan foydalanuvchi)", () => {
  const schema = createSupportSchema({ emailRequired: false });

  it("email ixtiyoriy", async () => {
    expect(await errors(schema, { ...valid, email: "" })).toEqual([]);
  });

  it("berilgan email baribir tekshiriladi", async () => {
    expect(await errors(schema, { ...valid, email: "xato" })).toEqual(["emailInvalid"]);
  });
});
