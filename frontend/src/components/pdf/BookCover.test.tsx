// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import uz from "@/lib/i18n/messages/uz.json";
import { BookCover } from "./BookCover";

afterEach(cleanup);

function setup(src?: string | null) {
  return render(
    <NextIntlClientProvider locale="uz" messages={uz}>
      <BookCover grade={9} subject="algebra" subjectTitle="Algebra" src={src} />
    </NextIntlClientProvider>,
  );
}

describe("BookCover", () => {
  it("renders the generated cover without an image", () => {
    setup(null);
    expect(screen.getByTestId("generated-cover")).toBeTruthy();
    expect(screen.queryByTestId("book-cover-image")).toBeNull();
  });

  it("renders the image over the generated fallback with fixed size", () => {
    const { container } = setup("https://cdn.test/c.webp");
    const img = container.querySelector("img")!;
    expect(img.getAttribute("src")).toBe("https://cdn.test/c.webp");
    expect(img.getAttribute("loading")).toBe("lazy");
    expect(img.getAttribute("width")).toBe("600");
    expect(screen.getByTestId("generated-cover")).toBeTruthy();
  });

  it("drops the broken image and keeps the generated cover", () => {
    const { container } = setup("https://cdn.test/broken.webp");
    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByTestId("generated-cover")).toBeTruthy();
  });
});
