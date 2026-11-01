import { describe, expect, it } from "vitest";
import {
  hasMath,
  insertSnippet,
  isInsideMath,
  MATH_SNIPPETS,
  splitMath,
  type MathSnippet,
} from "./math";

const snippet = (id: string): MathSnippet => {
  const found = Object.values(MATH_SNIPPETS)
    .flat()
    .find((item) => item.id === id);
  if (!found) throw new Error(id);
  return found;
};

describe("splitMath", () => {
  it("oddiy matn bitta bo'lak", () => {
    expect(splitMath("x ni toping")).toEqual([{ kind: "text", value: "x ni toping" }]);
  });

  it("qator ichidagi va alohida formulalarni ajratadi", () => {
    expect(splitMath("Javob $x^2$ va\n$$\\frac{1}{2}$$ tamom")).toEqual([
      { kind: "text", value: "Javob " },
      { kind: "inline", value: "x^2" },
      { kind: "text", value: " va\n" },
      { kind: "block", value: "\\frac{1}{2}" },
      { kind: "text", value: " tamom" },
    ]);
  });

  it("yopilmagan va bo'sh $ oddiy matn", () => {
    expect(splitMath("narxi 5$ edi")).toEqual([{ kind: "text", value: "narxi 5$ edi" }]);
    expect(splitMath("a $$ b")).toEqual([{ kind: "text", value: "a $$ b" }]);
    expect(splitMath("$ $")).toEqual([{ kind: "text", value: "$ $" }]);
  });

  it("\\$ — oddiy dollar, formulani ochmaydi", () => {
    expect(splitMath("narx \\$5 va $x$")).toEqual([
      { kind: "text", value: "narx $5 va " },
      { kind: "inline", value: "x" },
    ]);
  });

  it("formula ichidagi \\$ formulani yopmaydi", () => {
    expect(splitMath("$a\\$b$")).toEqual([{ kind: "inline", value: "a\\$b" }]);
  });

  it("hasMath faqat formula bo'lsa true", () => {
    expect(hasMath("matn")).toBe(false);
    expect(hasMath("5$ va 6$")).toBe(true); // ikkita $ orasi formula deb olinadi
    expect(hasMath("$x$")).toBe(true);
  });
});

describe("isInsideMath", () => {
  it("toq sondagi $ dan keyin ichida", () => {
    expect(isInsideMath("a $x", 4)).toBe(true);
    expect(isInsideMath("a $x$ b", 7)).toBe(false);
    expect(isInsideMath("a \\$5", 5)).toBe(false);
  });
});

describe("insertSnippet", () => {
  it("formula tashqarisida $ bilan o'raydi va kursorni birinchi {} ga qo'yadi", () => {
    const result = insertSnippet("Javob: ", 7, 7, snippet("fraction"));
    expect(result.value).toBe("Javob: $\\frac{}{}$");
    expect(result.caret).toBe(result.value.indexOf("{}") + 1);
  });

  it("formula ichida $ qo'shmaydi", () => {
    const result = insertSnippet("$x+$", 3, 3, snippet("root"));
    expect(result.value).toBe("$x+\\sqrt{}$");
    expect(result.caret).toBe(3 + "\\sqrt{".length);
  });

  it("belgilangan matn birinchi {} ichiga tushadi, kursor keyingisiga o'tadi", () => {
    const result = insertSnippet("x+1", 0, 3, snippet("fraction"));
    expect(result.value).toBe("$\\frac{x+1}{}$");
    expect(result.caret).toBe(result.value.indexOf("{}") + 1);
  });

  it("{} siz belgi (yunon harfi) oxiriga kursor qo'yadi", () => {
    const result = insertSnippet("", 0, 0, snippet("pi"));
    expect(result.value).toBe("$\\pi $");
    expect(result.caret).toBe("$\\pi ".length);
  });

  it("kursor chegaradan tashqarida bo'lsa qisiladi", () => {
    const result = insertSnippet("ab", 99, 99, snippet("alpha"));
    expect(result.value).toBe("ab$\\alpha $");
  });

  it("keyingi matn saqlanadi", () => {
    const result = insertSnippet("ab cd", 2, 2, snippet("power"));
    expect(result.value).toBe("ab$^{}$ cd");
  });

  it("ro'yxatda kasr, ildiz, daraja, indeks, integral va yunon harflari bor", () => {
    const ids = Object.values(MATH_SNIPPETS)
      .flat()
      .map((item) => item.id);
    for (const id of ["fraction", "root", "power", "subscript", "integral", "alpha", "pi"]) {
      expect(ids).toContain(id);
    }
  });
});
