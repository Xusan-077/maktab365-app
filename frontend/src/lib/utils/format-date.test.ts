import { describe, expect, it } from "vitest";
import { daysAgo, formatDate } from "./format-date";

// API UTC qaytaradi: 18:03 UTC = 23:03 Toshkent.
const AT = "2026-10-24T18:03:10Z";

describe("formatDate (uz — qo'lda, brauzer ICU'siga bog'liq emas)", () => {
  it("sana va vaqt: '24-okt, 23:03' (Toshkent vaqti)", () => {
    expect(formatDate(AT, "uz", "dateTime")).toBe("24-okt, 23:03");
  });

  it("to'liq sana: '24-oktabr, 2026'", () => {
    expect(formatDate(AT, "uz", "date")).toBe("24-oktabr, 2026");
  });

  it("kun va oy: '24-okt'", () => {
    expect(formatDate(AT, "uz", "dayMonth")).toBe("24-okt");
  });

  it("vaqt mintaqasi bir marta: Toshkentda ertasi kunga o'tadi", () => {
    expect(formatDate("2026-12-31T20:30:00Z", "uz", "dateTime")).toBe("1-yan, 01:30");
    expect(formatDate("2026-12-31T20:30:00Z", "uz", "date")).toBe("1-yanvar, 2027");
  });

  it("offset'li ISO ham bir xil vaqt sifatida o'qiladi", () => {
    expect(formatDate("2026-10-24T23:03:10+05:00", "uz", "dateTime")).toBe("24-okt, 23:03");
  });

  it("faqat sana (`2026-10-24`) siljimaydi", () => {
    expect(formatDate("2026-10-24", "uz", "date")).toBe("24-oktabr, 2026");
    expect(formatDate("2026-03-01", "uz", "dayMonth")).toBe("1-mar");
  });

  it("barcha oylar", () => {
    const months = Array.from({ length: 12 }, (_, i) =>
      formatDate(`2026-${String(i + 1).padStart(2, "0")}-15`, "uz", "date"),
    );
    expect(months).toEqual([
      "15-yanvar, 2026",
      "15-fevral, 2026",
      "15-mart, 2026",
      "15-aprel, 2026",
      "15-may, 2026",
      "15-iyun, 2026",
      "15-iyul, 2026",
      "15-avgust, 2026",
      "15-sentabr, 2026",
      "15-oktabr, 2026",
      "15-noyabr, 2026",
      "15-dekabr, 2026",
    ]);
  });
});

describe("formatDate (uz-Cyrl, ru, en — Intl, Toshkent vaqti)", () => {
  it.each(["uz-Cyrl", "ru", "en"] as const)("%s: vaqt 23:03, sana 24", (locale) => {
    const dateTime = formatDate(AT, locale, "dateTime");
    expect(dateTime).toContain("23:03");
    expect(dateTime).toContain("24");
    expect(formatDate(AT, locale, "date")).toContain("2026");
  });

  it("en va ru formatlari", () => {
    expect(formatDate(AT, "en", "date")).toBe("October 24, 2026");
    expect(formatDate(AT, "ru", "date")).toMatch(/^24 октября 2026/);
  });
});

describe("formatDate (yaroqsiz qiymat)", () => {
  it("bo'sh yoki noto'g'ri qiymatda bo'sh satr", () => {
    expect(formatDate(null, "uz", "date")).toBe("");
    expect(formatDate("emas", "uz", "date")).toBe("");
  });

  it("Date obyektini ham qabul qiladi", () => {
    expect(formatDate(new Date(AT), "uz", "dateTime")).toBe("24-okt, 23:03");
  });
});

describe("formatDate time va daysAgo", () => {
  it("vaqt Toshkentda: '09:41'", () => {
    expect(formatDate("2026-10-25T04:41:00Z", "uz", "time")).toBe("09:41");
  });

  it("kalendar kun farqi Toshkent vaqtida (UTC yarim tun emas)", () => {
    const now = new Date("2026-10-25T20:00:00Z"); // Toshkentda 26-okt, 01:00
    expect(daysAgo("2026-10-25T19:30:00Z", now)).toBe(0);
    expect(daysAgo("2026-10-25T10:00:00Z", now)).toBe(1);
    expect(daysAgo("2026-10-20T10:00:00Z", now)).toBe(6);
    expect(daysAgo("yaroqsiz", now)).toBeNull();
  });
});
