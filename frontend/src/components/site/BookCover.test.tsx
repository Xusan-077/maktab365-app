// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, describe, expect, it } from "vitest";
import { BookCover } from "./BookCover";

const messages = { site: { cover: { grade: "{grade}-sinf" } } };
const renderCover = (props: Partial<Parameters<typeof BookCover>[0]>) =>
  render(
    <NextIntlClientProvider locale="uz" messages={messages}>
      <BookCover grade={9} title="Algebra" group="exact" {...props} />
    </NextIntlClientProvider>,
  );

describe("BookCover", () => {
  afterEach(cleanup);

  it("rasm yo'q — faqat guruh rangidagi zaxira", () => {
    const { container, getByText } = renderCover({});
    expect(container.querySelector("img")).toBeNull();
    expect(getByText("9-sinf")).toBeTruthy();
    expect(getByText("Algebra")).toBeTruthy();
  });

  it("rasm yo'q — gradient kartochka: nom, sinf va 3:4 nisbat saqlanadi", () => {
    const { container, getByTestId, getByText } = renderCover({ group: "natural" });
    const fallback = getByTestId("book-cover-fallback");
    expect(fallback.style.backgroundImage).toContain("linear-gradient");
    expect(fallback.style.backgroundImage).toContain("var(--group-natural)");
    expect(getByText("9-sinf")).toBeTruthy();
    expect(getByText("Algebra")).toBeTruthy();
    expect((container.firstElementChild as HTMLElement).className).toContain("aspect-[3/4]");
  });

  it("noma'lum guruh — brend ko'ki gradienti", () => {
    const { getByTestId } = renderCover({ group: null });
    expect(getByTestId("book-cover-fallback").style.backgroundImage).toContain(
      "var(--group-exact)",
    );
  });

  it("rasm yuklanmasa (onError) — rasm olib tashlanadi, zaxira va nisbat qoladi", () => {
    const { container, getByTestId, getByText } = renderCover({
      src: "https://cdn.test/covers/missing.png",
    });
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(getByTestId("book-cover-fallback")).toBeTruthy(); // rasm ostida doim turadi

    fireEvent.error(img as HTMLImageElement);

    expect(container.querySelector("img")).toBeNull();
    expect(getByText("Algebra")).toBeTruthy();
    expect((container.firstElementChild as HTMLElement).className).toContain("aspect-[3/4]");
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

  it("variantlar yo'q (eski kitob) — asl URL o'zgarishsiz, srcset va kenglik parametri yo'q", () => {
    const { container } = renderCover({ src: "https://cdn.test/covers/orig.png", sizes: "200px" });
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe("https://cdn.test/covers/orig.png");
    expect(img?.hasAttribute("srcset")).toBe(false);
    expect(img?.outerHTML).not.toContain("?w=");
  });

  it("faqat bitta variant bor — asl rasm o'zgarishsiz (srcset yo'q, kenglik parametri yo'q)", () => {
    const { container } = renderCover({
      src: "https://cdn.test/covers/orig.png",
      srcSmall: "https://cdn.test/covers/a-300.webp",
      sizes: "200px",
    });
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe("https://cdn.test/covers/orig.png");
    expect(img?.hasAttribute("srcset")).toBe(false);
    expect(img?.outerHTML).not.toContain("?w=");
  });
});
