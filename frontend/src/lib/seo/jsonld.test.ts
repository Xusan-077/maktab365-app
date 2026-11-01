import { describe, expect, it } from "vitest";
import type { BookDetail } from "@/lib/books/api";
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
  cover_small: null,
  language: "uz",
  unverified: false,
  published_at: "2026-10-22T00:00:00Z",
  ...over,
});
const detail = (over: Partial<PdfBookDetail> = {}): PdfBookDetail => ({
  ...item(),
  description: "",
  cover_large: null,
  has_text_layer: true,
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

describe("jsonld: Organization, WebSite, kutubxona kitobi", () => {
  it("Organization va WebSite (qidiruv oynasi bilan) to'g'ri bog'langan", async () => {
    const { organizationJsonLd, websiteJsonLd } = await import("./jsonld");
    const org = organizationJsonLd(SITE, "darslik365", "Tavsif");
    expect(org["@type"]).toBe("Organization");
    expect(org.logo).toBe("https://maktab365.uz/icon-512.png");
    const site = websiteJsonLd(SITE, "uz", "darslik365");
    expect(site["@type"]).toBe("WebSite");
    expect(site.publisher["@id"]).toBe(org["@id"]);
    expect(site.potentialAction.target.urlTemplate).toBe(
      "https://maktab365.uz/uz/darsliklar?q={search_term_string}",
    );
    expect(site.potentialAction["query-input"]).toContain("search_term_string");
  });

  it("libraryBookJsonLd: muallif, til, rasm, daraja; bo'sh maydonlar yozilmaydi", async () => {
    const { libraryBookJsonLd } = await import("./jsonld");
    const base = {
      id: "1",
      slug: "otkan-kunlar",
      title: "O'tkan kunlar",
      author: "Abdulla Qodiriy",
      book_type: { id: "t", slug: "badiiy-kitoblar", name: { uz: "Badiiy kitoblar" } },
      reading_mode: "fiction",
      grade_level: 9,
      language: "uz",
      page_count: 300,
      cover: "https://cdn/x.webp",
      created_at: "2026-10-01T00:00:00Z",
      description: "",
      chapters: [],
      has_text_layer: true,
    } satisfies BookDetail;
    const full = libraryBookJsonLd(SITE, "uz", base);
    expect(full).toMatchObject({
      "@type": "Book",
      name: "O'tkan kunlar",
      inLanguage: "uz",
      educationalLevel: "9",
      image: "https://cdn/x.webp",
      author: { "@type": "Person", name: "Abdulla Qodiriy" },
      url: "https://maktab365.uz/uz/kutubxona/otkan-kunlar",
    });
    expect("description" in full).toBe(false);
    const bare = libraryBookJsonLd(SITE, "uz", {
      ...base,
      author: "",
      cover: null,
      grade_level: null,
    });
    expect("author" in bare || "image" in bare || "educationalLevel" in bare).toBe(false);
  });

  it("JSON-LD '<' belgisini qochiradi va to'g'ri JSON bo'lib qoladi", () => {
    const text = serializeJsonLd({ name: "</script><b>" });
    expect(text).not.toContain("<");
    expect(JSON.parse(text).name).toBe("</script><b>");
  });
});
