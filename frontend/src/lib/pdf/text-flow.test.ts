import { describe, expect, it } from "vitest";
import { textFlow } from "./text-flow";

const item = (str: string, y: number, extra: object = {}) => ({
  str,
  transform: [10, 0, 0, 10, 0, y],
  height: 10,
  ...extra,
});

describe("textFlow", () => {
  it("bir qatordagi bo'laklarni birlashtiradi, yangi qatordan boshlaydi", () => {
    const text = textFlow([item("Salom ", 700), item("dunyo", 700), item("Ikkinchi qator", 688)]);
    expect(text).toBe("Salom dunyo\nIkkinchi qator");
  });

  it("katta oraliqdan keyin yangi xatboshi (bo'sh qator) qo'yadi", () => {
    const text = textFlow([item("Birinchi", 700), item("Ikkinchi", 650)]);
    expect(text).toBe("Birinchi\n\nIkkinchi");
  });

  it("hasEOL qatorni tugatadi; bo'sh bo'laklar va marker obyektlari e'tiborga olinmaydi", () => {
    const text = textFlow([
      item("A", 700, { hasEOL: true }),
      { type: "beginMarkedContent" },
      item("   ", 700),
      item("B", 700),
    ]);
    expect(text).toBe("A\nB");
  });

  it("matn qatlami yo'q sahifada bo'sh satr qaytaradi", () => {
    expect(textFlow([])).toBe("");
  });
});
