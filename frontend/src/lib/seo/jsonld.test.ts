import { describe, expect, it } from "vitest";
import type { PdfBook, PdfBookDetail } from "@/lib/pdf-books/api";
import { absoluteUrl, bookItemList, bookJsonLd, breadcrumbList, serializeJsonLd } from "./jsonld";

const SITE = "https://maktab365.uz/";
const item = (over: Partial<PdfBook> = {}): PdfBook => ({
  id: "b1",
  slug: "9-sinf-algebra",
  title: { uz: "Algebra", ru: "Алгебра" },
  grade: 9,
  subject: "algebra",
  subject_title: { uz: "Algebra" },
  subject_group: "exact",
  page_count: 240,
  size_bytes: 1000,
  cover: null,
  unverified: false,
  published_at: "2026-10-22T00:00:00Z",
  ...over,
});
const detail = (over: Partial<PdfBookDetail> = {}): PdfBookDetail => ({
  ...item(),
  description: "",
  language: "uz",
  allow_download: true,
  chapters: [],
  ...over,
});

describe("jsonld", () => {
  it("absoluteUrl tilni qo'shadi", () => {
    expect(absoluteUrl(SITE, "uz", "/darsliklar/9")).toBe("https://maktab365.uz/uz/darsliklar/9");
    expect(absoluteUrl(SITE, "ru", "/")).toBe("https://maktab365.uz/ru");
  });

  it("BreadcrumbList pozitsiyalari 1 dan", () => {
    const data = breadcrumbList(SITE, "uz", [
      { name: "Bosh sahifa", path: "/" },
      { name: "Darsliklar", path: "/darsliklar" },
    ]);
    expect(data["@type"]).toBe("BreadcrumbList");
    expect(data.itemListElement.map((x) => x.position)).toEqual([1, 2]);
    expect(data.itemListElement[1].item).toBe("https://maktab365.uz/uz/darsliklar");
  });

  it("ItemList kitoblarni tilga mos nom va to'liq URL bilan beradi", () => {
    const data = bookItemList(SITE, "ru", "Учебники", [item()]);
    expect(data.numberOfItems).toBe(1);
    expect(data.itemListElement[0]).toMatchObject({
      name: "Алгебра",
      url: "https://maktab365.uz/ru/darsliklar/9/9-sinf-algebra",
    });
  });

  it("Book: faqat haqiqiy maydonlar; bo'sh tavsif va rasm yozilmaydi", () => {
    const bare = bookJsonLd(SITE, "uz", detail(), "Algebra");
    expect(bare).toMatchObject({
      "@type": "Book",
      name: "Algebra",
      numberOfPages: 240,
      inLanguage: "uz",
      isAccessibleForFree: true,
    });
    expect("description" in bare).toBe(false);
    expect("image" in bare).toBe(false);

    const full = bookJsonLd(
      SITE,
      "uz",
      detail({ description: "Qo'llanma" }),
      "Algebra",
      "https://cdn/c.webp",
    );
    expect(full).toMatchObject({ description: "Qo'llanma", image: "https://cdn/c.webp" });
  });

  it("serializeJsonLd '<' belgisini qochiradi", () => {
    expect(serializeJsonLd({ a: "</script><b>" })).not.toContain("<");
  });
});
