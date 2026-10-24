import { describe, expect, it } from "vitest";
import { latinToCyrillic, transliterateMessage, transliterateMessages } from "./translit";

describe("latinToCyrillic", () => {
  it.each([
    ["salom", "салом"],
    ["maktab", "мактаб"],
    ["O'zbekiston", "Ўзбекистон"],
    ["g'alaba", "ғалаба"],
    ["Oʻzbek", "Ўзбек"],
    ["g‘oya", "ғоя"],
    ["shahar", "шаҳар"],
    ["Chorshanba", "Чоршанба"],
    ["SHAHAR", "ШАҲАР"],
    ["tong", "тонг"],
    ["tong'", "тонғ"],
    ["yer", "ер"],
    ["Yevropa", "Европа"],
    ["yo'l", "йўл"],
    ["yosh", "ёш"],
    ["Yulduz", "Юлдуз"],
    ["yaxshi", "яхши"],
    ["tayyor", "тайёр"],
    ["eshik", "эшик"],
    ["Elektr", "Электр"],
    ["menga", "менга"],
    ["ma'no", "маъно"],
    ["she'r", "шеър"],
    ["e'lon", "эълон"],
    ["Is'hoq", "Исҳоқ"],
    ["qalam", "қалам"],
    ["xat", "хат"],
    ["hayot", "ҳаёт"],
    ["jadval", "жадвал"],
    ["vazifa", "вазифа"],
    ["operatsiya", "операция"],
    ["Natsional", "Национал"],
    ["protsent", "процент"],
    ["Tsement", "Цемент"],
    ["otsiz", "отсиз"],
    ["mutatsiya", "мутация"],
  ])("%s → %s", (latin, cyrillic) => {
    expect(latinToCyrillic(latin)).toBe(cyrillic);
  });

  it("raqam, tinish belgisi va kirillni o'zgartirmaydi", () => {
    expect(latinToCyrillic("1–11-sinf, 2025!")).toBe("1–11-синф, 2025!");
    expect(latinToCyrillic("Привет")).toBe("Привет");
  });

  it("harfga yopishmagan tutuq (qo'shtirnoq o'rnida) o'zgarmaydi", () => {
    expect(latinToCyrillic("'salom'")).toBe("'салом'");
  });

  it("gap: tutuq, digraf va katta harflar birga", () => {
    expect(latinToCyrillic("Bo'lim mavzulari: Yo'riqnoma va ma'lumot")).toBe(
      "Бўлим мавзулари: Йўриқнома ва маълумот",
    );
  });
});

describe("matematik ifodalar", () => {
  it.each([
    ["x² + px + q = 0 tenglama", "x² + px + q = 0 тенглама"],
    ["Yig'indi x₁ + x₂ = −p ga teng", "Йиғинди x₁ + x₂ = −p га тенг"],
    ["Bu yerda p = −7 bo'ladi", "Бу ерда p = −7 бўлади"],
    ["ildiz x₁ va x₂", "илдиз x₁ ва x₂"],
    ["ax² + bx + c = 0 (a ≠ 0)", "ax² + bx + c = 0 (a ≠ 0)"],
    ["va/yoki", "ва/ёки"],
    ["5-sinf va 1–11-sinf", "5-синф ва 1–11-синф"],
  ])("%s → %s", (latin, cyrillic) => {
    expect(latinToCyrillic(latin)).toBe(cyrillic);
  });
});

describe("transliterateMessage", () => {
  it("ICU argumentlari o'zgarmaydi", () => {
    expect(transliterateMessage("Salom, {name}!")).toBe("Салом, {name}!");
  });

  it("plural tarmoqlari ichidagi matn o'giriladi, kalit so'zlar emas", () => {
    expect(transliterateMessage("{count, plural, one {# ta mavzu} other {# ta mavzu}}")).toBe(
      "{count, plural, one {# та мавзу} other {# та мавзу}}",
    );
  });

  it("HTML teglar saqlanadi", () => {
    expect(transliterateMessage("<b>Muhim</b> fikr")).toBe("<b>Муҳим</b> фикр");
  });
});

describe("transliterateMessages", () => {
  const tree = {
    nav: { home: "Bosh sahifa" },
    language: { names: { en: "English" } },
  };

  it("ichma-ich daraxtni o'giradi", () => {
    expect(transliterateMessages(tree)).toEqual({
      nav: { home: "Бош саҳифа" },
      language: { names: { en: "Энглиш" } },
    });
  });

  it("skip berilgan yo'llar o'zgarishsiz qoladi", () => {
    expect(transliterateMessages(tree, (path) => path === "language.names")).toEqual({
      nav: { home: "Бош саҳифа" },
      language: { names: { en: "English" } },
    });
  });
});
