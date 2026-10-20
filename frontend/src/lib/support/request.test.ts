import { describe, expect, it } from "vitest";
import { buildSupportInput, type SupportFormValues } from "./request";

const values: SupportFormValues = {
  kind: "content_error",
  email: "  ali@example.com ",
  message: "  Formulada xato bor  ",
  website: "",
};

describe("buildSupportInput", () => {
  it("qiymatlarni qirqadi va kontekstni qo'shadi", () => {
    expect(buildSupportInput(values, { topic: "algebra-1", pageUrl: "https://x.uz/uz/a" })).toEqual(
      {
        kind: "content_error",
        message: "Formulada xato bor",
        email: "ali@example.com",
        topic: "algebra-1",
        pageUrl: "https://x.uz/uz/a",
      },
    );
  });

  it("bo'sh email va kontekstni yubormaydi", () => {
    expect(buildSupportInput({ ...values, email: " " })).toEqual({
      kind: "content_error",
      message: "Formulada xato bor",
    });
  });

  it("sahifa manzilini backend limitigacha (500) qisqartiradi", () => {
    const input = buildSupportInput(values, { pageUrl: `https://x.uz/${"a".repeat(600)}` });
    expect(input?.pageUrl).toHaveLength(500);
  });

  it("honeypot to'ldirilgan bo'lsa so'rov yasalmaydi (bot)", () => {
    expect(buildSupportInput({ ...values, website: "http://spam.example" })).toBeNull();
    expect(buildSupportInput({ ...values, website: "  x " })).toBeNull();
  });
});
