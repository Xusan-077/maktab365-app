import { describe, expect, it } from "vitest";
import {
  buildMetadata,
  clamp,
  clampDescription,
  clampTitle,
  DESCRIPTION_MAX,
  NOINDEX,
  splitKeywords,
  TITLE_MAX,
  TITLE_SUFFIX,
} from "./metadata";

describe("clamp", () => {
  it("qisqa matnni o'zgartirmaydi, uzunini so'z chegarasida kesadi", () => {
    expect(clamp("  Algebra   9  ", 20)).toBe("Algebra 9");
    const cut = clamp("Matematika darsligi to'qqizinchi sinf uchun", 25);
    expect(cut.length).toBeLessThanOrEqual(25);
    expect(cut.endsWith("…")).toBe(true);
  });
});

describe("buildMetadata", () => {
  const base = {
    locale: "uz" as const,
    path: "/darsliklar",
    title: "Darsliklar",
    description: "x",
  };

  it("sarlavha shablon bilan 60 belgidan, tavsif 155 dan oshmaydi", () => {
    const long = "A".repeat(200) + " " + "B".repeat(50);
    expect(clampTitle(long).length + TITLE_SUFFIX.length).toBeLessThanOrEqual(TITLE_MAX);
    expect(clampDescription(long).length).toBeLessThanOrEqual(DESCRIPTION_MAX);
    const meta = buildMetadata({ ...base, title: long, description: long });
    expect((meta.title as string).length + TITLE_SUFFIX.length).toBeLessThanOrEqual(TITLE_MAX);
    expect((meta.description as string).length).toBeLessThanOrEqual(DESCRIPTION_MAX);
  });

  it("canonical, barcha tillar + x-default, OG locale, Twitter va rasm bor", () => {
    const meta = buildMetadata({ ...base, keywords: ["maktab darsliklari"] });
    expect(meta.alternates?.canonical).toBe("/uz/darsliklar");
    expect(Object.keys(meta.alternates?.languages ?? {}).sort()).toEqual(
      ["en", "ru", "uz", "uz-Cyrl", "x-default"].sort(),
    );
    expect(meta.openGraph).toMatchObject({
      locale: "uz_UZ",
      type: "website",
      siteName: "darslik365",
    });
    expect((meta.openGraph as { url: string }).url).toMatch(/\/uz\/darsliklar$/);
    expect(meta.twitter).toMatchObject({ card: "summary_large_image" });
    expect((meta.openGraph as { images: { width: number }[] }).images[0].width).toBe(1200);
    expect(meta.keywords).toEqual(["maktab darsliklari"]);
    expect(meta.robots).toBeUndefined();
  });

  it("muqova berilsa OG rasm shu; noindex robots'ni yopadi; bosh sahifa absolyut sarlavha", () => {
    const image = { url: "https://cdn/x.webp", width: 400, height: 600, alt: "Kitob" };
    const meta = buildMetadata({
      ...base,
      image,
      noindex: true,
      type: "book",
      absoluteTitle: true,
    });
    expect((meta.openGraph as { images: unknown[] }).images).toEqual([image]);
    expect(meta.robots).toEqual(NOINDEX);
    expect(meta.title).toEqual({ absolute: "Darsliklar" });
  });

  it("ru va uz-Cyrl uchun og:locale", () => {
    expect((buildMetadata({ ...base, locale: "ru" }).openGraph as { locale: string }).locale).toBe(
      "ru_RU",
    );
    expect(
      (buildMetadata({ ...base, locale: "uz-Cyrl" }).openGraph as { locale: string }).locale,
    ).toBe("uz_UZ");
  });
});

describe("splitKeywords", () => {
  it("vergul bo'yicha ajratadi va bo'shlarni tashlaydi", () => {
    expect(splitKeywords(" a, b ,, c ")).toEqual(["a", "b", "c"]);
  });
});
