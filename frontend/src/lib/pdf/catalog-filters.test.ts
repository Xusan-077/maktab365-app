import { describe, expect, it } from "vitest";
import {
  activeFilterCount,
  catalogHref,
  catalogQuery,
  EMPTY_FILTERS,
  parseCatalogFilters,
  toApiFilters,
} from "./catalog-filters";

describe("parseCatalogFilters", () => {
  it("bo'sh URL — standart filtrlar", () => {
    expect(parseCatalogFilters({})).toEqual(EMPTY_FILTERS);
  });

  it("hamma filtr", () => {
    expect(
      parseCatalogFilters({
        sinf: "9",
        fan: "algebra",
        guruh: "tabiiy,aniq",
        til: "ru",
        q: " algebra ",
        tartib: "yangi",
        bet: "3",
      }),
    ).toEqual({
      grade: 9,
      subject: "algebra",
      groups: ["exact", "natural"],
      language: "ru",
      q: "algebra",
      sort: "newest",
      page: 3,
    });
  });

  it("noto'g'ri qiymatlar tashlanadi (Qoraqalpoqcha, 12-sinf, begona guruh, katta bet)", () => {
    expect(
      parseCatalogFilters({
        sinf: "12",
        fan: "../x",
        guruh: "yo'q,sanat",
        til: "kaa",
        tartib: "x",
        bet: "-1",
      }),
    ).toEqual({ ...EMPTY_FILTERS, groups: ["arts"] });
  });

  it("takrorlangan guruh parametri ham o'qiladi", () => {
    expect(parseCatalogFilters({ guruh: ["aniq", "tillar"] }).groups).toEqual([
      "exact",
      "language",
    ]);
  });
});

describe("catalogQuery / catalogHref", () => {
  it("kanonik tartib va bo'sh filtr uchun bo'sh query", () => {
    expect(catalogQuery(EMPTY_FILTERS)).toBe("");
    const filters = parseCatalogFilters({ guruh: "tabiiy,aniq", sinf: "5", bet: "2" });
    expect(catalogQuery(filters)).toBe("sinf=5&guruh=aniq%2Ctabiiy&bet=2");
  });

  it("filtr o'zgarganda sahifa 1 ga qaytadi", () => {
    const filters = parseCatalogFilters({ sinf: "5", bet: "4" });
    expect(catalogHref("/darsliklar", filters, { language: "uz" })).toBe(
      "/darsliklar?sinf=5&til=uz",
    );
    expect(catalogHref("/darsliklar", filters, { page: 5 })).toBe("/darsliklar?sinf=5&bet=5");
    expect(catalogHref("/darsliklar", EMPTY_FILTERS)).toBe("/darsliklar");
  });
});

describe("activeFilterCount / toApiFilters", () => {
  it("saralash va sahifa sanalmaydi", () => {
    const filters = parseCatalogFilters({
      sinf: "9",
      guruh: "aniq,tabiiy",
      tartib: "yangi",
      bet: "2",
    });
    expect(activeFilterCount(filters)).toBe(3);
  });

  it("API filtrlari", () => {
    const api = toApiFilters(
      parseCatalogFilters({ sinf: "9", guruh: "aniq", til: "uz", tartib: "yangi", bet: "2" }),
    );
    expect(api).toMatchObject({
      grade: 9,
      groups: ["exact"],
      language: "uz",
      ordering: "newest",
      page: 2,
      pageSize: 24,
    });
  });
});
