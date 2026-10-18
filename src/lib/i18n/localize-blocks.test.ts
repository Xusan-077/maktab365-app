import { describe, expect, it } from "vitest";
import { localize } from "./localize-blocks";

describe("localize", () => {
  const data = {
    prompt: "I ___ there.",
    options: [{ text: "went", reason: { uz: "uz", ru: "ru" } }],
  };

  it("ichma-ich LocalizedText ni o'giradi, oddiy satrlarga tegmaydi", () => {
    expect(localize(data, "ru")).toEqual({
      prompt: "I ___ there.",
      options: [{ text: "went", reason: "ru" }],
    });
  });

  it("tarjima yo'q bo'lsa uz'ga qaytadi", () => {
    expect(localize(data, "en").options[0].reason).toBe("uz");
  });
});
