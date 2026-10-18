import { describe, expect, it } from "vitest";
import { getLocalized } from "./localized";

const full = { uz: "Bo'lim", ru: "Раздел", en: "Section" };

describe("getLocalized", () => {
  it("har tilda o'z matnini qaytaradi", () => {
    expect(getLocalized(full, "uz")).toBe("Bo'lim");
    expect(getLocalized(full, "ru")).toBe("Раздел");
    expect(getLocalized(full, "en")).toBe("Section");
  });

  it("uz-Cyrl uz'dan translit qiladi", () => {
    expect(getLocalized(full, "uz-Cyrl")).toBe("Бўлим");
  });

  it("tarjima yo'q bo'lsa uz'ga fallback", () => {
    expect(getLocalized({ uz: "Bo'lim" }, "ru")).toBe("Bo'lim");
    expect(getLocalized({ uz: "Bo'lim" }, "en")).toBe("Bo'lim");
  });

  it("bo'sh tarjima (\"\" yoki bo'shliq) ham uz'ga fallback qiladi", () => {
    expect(getLocalized({ uz: "Bo'lim", ru: "", en: "  " }, "ru")).toBe("Bo'lim");
    expect(getLocalized({ uz: "Bo'lim", ru: "", en: "  " }, "en")).toBe("Bo'lim");
  });

  it("tarjima yo'q bo'lsa uz-Cyrl baribir uz'dan translit qiladi", () => {
    expect(getLocalized({ uz: "Bo'lim", ru: "" }, "uz-Cyrl")).toBe("Бўлим");
  });
});
