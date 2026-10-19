import { describe, expect, it } from "vitest";
import {
  filterOptions,
  findTypeaheadMatch,
  initialActiveIndex,
  isTypeaheadKey,
  moveActive,
  nextTypeahead,
  resolveListKey,
  toggleMulti,
  type SelectOption,
} from "./select-logic";

const options: SelectOption[] = [
  { value: "algebra", label: "Algebra" },
  { value: "biologiya", label: "Biologiya", disabled: true },
  { value: "geometriya", label: "Geometriya", keywords: "math" },
  { value: "geografiya", label: "Geografiya" },
  { value: "tarix", label: "Tarix" },
];

describe("klaviatura bilan harakat", () => {
  it("strelkalar o'chirilgan variantni o'tkazib yuboradi", () => {
    expect(moveActive(options, 0, "ArrowDown")).toBe(2);
    expect(moveActive(options, 2, "ArrowUp")).toBe(0);
  });

  it("chetda to'xtaydi, aylanmaydi", () => {
    expect(moveActive(options, 0, "ArrowUp")).toBe(0);
    expect(moveActive(options, 4, "ArrowDown")).toBe(4);
  });

  it("Home/End birinchi va oxirgi faol variantga o'tadi", () => {
    expect(moveActive(options, 3, "Home")).toBe(0);
    expect(moveActive(options, 0, "End")).toBe(4);
  });

  it("faol variant yo'q bo'lsa pastga birinchisiga, yuqoriga oxirgisiga o'tadi", () => {
    expect(moveActive(options, -1, "ArrowDown")).toBe(0);
    expect(moveActive(options, -1, "ArrowUp")).toBe(4);
  });

  it("hammasi o'chirilgan bo'lsa -1", () => {
    expect(moveActive([{ value: "a", label: "A", disabled: true }], 0, "ArrowDown")).toBe(-1);
  });

  it("ochilganda tanlangan variant faol bo'ladi", () => {
    expect(initialActiveIndex(options, ["tarix"])).toBe(4);
    expect(initialActiveIndex(options, [])).toBe(0);
  });
});

describe("resolveListKey", () => {
  const context = { options, active: 0, searching: false };

  it("Enter va bo'shliq tanlaydi, Esc yopadi", () => {
    expect(resolveListKey("Enter", context)).toEqual({ type: "select" });
    expect(resolveListKey(" ", context)).toEqual({ type: "select" });
    expect(resolveListKey("Escape", context)).toEqual({ type: "close" });
    expect(resolveListKey("Tab", context)).toEqual({ type: "tab" });
  });

  it("ArrowDown faol indeksni siljitadi", () => {
    expect(resolveListKey("ArrowDown", context)).toEqual({ type: "move", active: 2 });
  });

  it("qidiruv maydonida bo'shliq va Home/End matnga qoladi", () => {
    const searching = { ...context, searching: true };
    expect(resolveListKey(" ", searching)).toBeNull();
    expect(resolveListKey("Home", searching)).toBeNull();
    expect(resolveListKey("Enter", searching)).toEqual({ type: "select" });
  });

  it("begona tugma — null", () => {
    expect(resolveListKey("a", context)).toBeNull();
  });
});

describe("typeahead", () => {
  it("bosilgan harflar buferga yig'iladi, pauzadan keyin yangilanadi", () => {
    let state = nextTypeahead({ buffer: "", at: 0 }, "G", 100);
    state = nextTypeahead(state, "e", 300);
    expect(state.buffer).toBe("ge");
    state = nextTypeahead(state, "o", 2000);
    expect(state.buffer).toBe("o");
  });

  it("prefiks bo'yicha topadi va o'chirilganni o'tkazadi", () => {
    expect(findTypeaheadMatch(options, "t", 0)).toBe(4);
    expect(findTypeaheadMatch(options, "bio", 0)).toBe(-1);
    expect(findTypeaheadMatch(options, "geog", 0)).toBe(3);
  });

  it("bir xil harf takrorlansa shu harfli variantlar bo'ylab aylanadi", () => {
    expect(findTypeaheadMatch(options, "g", 0)).toBe(2);
    expect(findTypeaheadMatch(options, "gg", 2)).toBe(3);
    expect(findTypeaheadMatch(options, "ggg", 3)).toBe(2);
  });

  it("faqat bitta belgi yozadigan tugmalar typeahead hisoblanadi", () => {
    const base = { ctrlKey: false, metaKey: false, altKey: false };
    expect(isTypeaheadKey({ key: "a", ...base })).toBe(true);
    expect(isTypeaheadKey({ key: " ", ...base })).toBe(false);
    expect(isTypeaheadKey({ key: "Enter", ...base })).toBe(false);
    expect(isTypeaheadKey({ key: "a", ...base, ctrlKey: true })).toBe(false);
  });
});

describe("qidiruv", () => {
  it("yorliq va kalit so'zlar bo'yicha, katta-kichik harfga e'tiborsiz", () => {
    expect(filterOptions(options, "GEO").map((o) => o.value)).toEqual(["geometriya", "geografiya"]);
    expect(filterOptions(options, "math").map((o) => o.value)).toEqual(["geometriya"]);
    expect(filterOptions(options, "  ")).toBe(options);
    expect(filterOptions(options, "zzz")).toEqual([]);
  });
});

describe("ko'p tanlov", () => {
  it("qo'shadi va olib tashlaydi, tartib variantlar bo'yicha", () => {
    let values = toggleMulti([], "tarix", options);
    values = toggleMulti(values, "algebra", options);
    expect(values).toEqual(["algebra", "tarix"]);
    expect(toggleMulti(values, "tarix", options)).toEqual(["algebra"]);
  });
});
