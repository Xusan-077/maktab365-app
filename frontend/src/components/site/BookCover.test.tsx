// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";
import { BookCover } from "./BookCover";

const messages = { site: { cover: { grade: "{grade}-sinf" } } };
const renderCover = (props: Partial<Parameters<typeof BookCover>[0]>) =>
  render(
    <NextIntlClientProvider locale="uz" messages={messages}>
      <BookCover grade={9} title="Algebra" group="exact" {...props} />
    </NextIntlClientProvider>,
  );

describe("BookCover", () => {
  it("rasm yo'q — faqat guruh rangidagi zaxira", () => {
    const { container, getByText } = renderCover({});
    expect(container.querySelector("img")).toBeNull();
    expect(getByText("9-sinf")).toBeTruthy();
    expect(getByText("Algebra")).toBeTruthy();
  });

  it("srcset kichik kengliklar uchun 300px, kattalar uchun 600px variantni beradi", () => {
    const { container } = renderCover({
      src: "https://cdn.test/covers/orig.png",
      srcSmall: "https://cdn.test/covers/a-300.webp",
      srcLarge: "https://cdn.test/covers/a-600.webp",
      sizes: "200px",
    });
    const srcSet = container.querySelector("img")?.getAttribute("srcset") ?? "";
    expect(srcSet).toContain("https://cdn.test/covers/a-300.webp");
    expect(srcSet).toContain("https://cdn.test/covers/a-600.webp");
    expect(srcSet).not.toContain("orig.png");
  });

  it("variantlar yo'q (eski kitob) — asl rasm ishlatiladi", () => {
    const { container } = renderCover({ src: "https://cdn.test/covers/orig.png" });
    const img = container.querySelector("img");
    expect(`${img?.getAttribute("src")}${img?.getAttribute("srcset")}`).toContain("orig.png");
  });

  it("variantlar yo'q — asl URL kenglik parametri bilan beriladi (har kenglikka alohida URL)", () => {
    const { container } = renderCover({ src: "https://cdn.test/covers/orig.png", sizes: "200px" });
    const srcSet = container.querySelector("img")?.getAttribute("srcset") ?? "";
    expect(srcSet).toMatch(/orig\.png\?w=\d+/);
    expect(
      new Set(srcSet.split(",").map((part) => part.trim().split(" ")[0])).size,
    ).toBeGreaterThan(1);
  });

  it("faqat bitta variant bor — boshqa kenglikda ham ishlaydi", () => {
    const { container } = renderCover({
      src: "https://cdn.test/covers/orig.png",
      srcSmall: "https://cdn.test/covers/a-300.webp",
      sizes: "200px",
    });
    const srcSet = container.querySelector("img")?.getAttribute("srcset") ?? "";
    expect(srcSet).toContain("a-300.webp");
    expect(srcSet).toContain("orig.png?w=");
  });
});
