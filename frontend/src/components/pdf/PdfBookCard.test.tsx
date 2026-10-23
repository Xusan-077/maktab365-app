// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import uz from "@/lib/i18n/messages/uz.json";
import type { PdfBook } from "@/lib/pdf-books/api";

vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { PdfBookCard, readFraction } from "./PdfBookCard";

const book = (over: Partial<PdfBook> = {}): PdfBook => ({
  id: "b1",
  title: { uz: "Algebra 9" },
  grade: 9,
  subject: "algebra",
  subject_title: { uz: "Algebra" },
  page_count: 200,
  size_bytes: 12 * 1024 * 1024,
  cover: null,
  unverified: false,
  published_at: null,
  ...over,
});

function setup(props: Partial<React.ComponentProps<typeof PdfBookCard>> = {}) {
  render(
    <NextIntlClientProvider locale="uz" messages={uz}>
      <PdfBookCard book={book()} {...props} />
    </NextIntlClientProvider>,
  );
}

afterEach(cleanup);

describe("PdfBookCard", () => {
  it("muqovasi bo'lmasa generativ muqova: sinf raqami va fan nomi, fan guruhi rangi", () => {
    setup();
    const cover = screen.getByTestId("generated-cover");
    expect(cover.getAttribute("data-tone")).toBe("exact");
    expect(cover.textContent).toContain("9");
    expect(cover.textContent).toContain(uz.pdfBooks.cover.grade);
    expect(cover.textContent).toContain(uz.pdfBooks.cover.textbook);
    expect(cover.textContent).toContain("Algebra");
  });

  it("noma'lum fan uchun barqaror zaxira ohang", () => {
    setup({ book: book({ subject: "astronomiya", subject_title: { uz: "Astronomiya" } }) });
    expect(screen.getByTestId("generated-cover").getAttribute("data-tone")).toMatch(/^fallback-/);
  });

  it("o'z muqovasi bo'lsa rasm, yuklanmasa generativ muqovaga qaytadi", () => {
    const { container } = render(
      <NextIntlClientProvider locale="uz" messages={uz}>
        <PdfBookCard book={book({ cover: "https://r2.test/c.png" })} />
      </NextIntlClientProvider>,
    );
    const img = container.querySelector("img") as HTMLImageElement;
    expect(img.src).toBe("https://r2.test/c.png");
    expect(screen.queryByTestId("generated-cover")).toBeNull();

    fireEvent.error(img);

    expect(screen.getByTestId("generated-cover")).toBeTruthy();
  });

  it("nom, sinf va fan, hajm (MB) va betlar sonini ko'rsatadi", () => {
    setup();
    expect(screen.getByText("Algebra 9")).toBeTruthy();
    expect(screen.getByText("9-sinf · Algebra")).toBeTruthy();
    expect(screen.getByText("12 MB · 200 bet")).toBeTruthy();
    expect(screen.queryByTestId("pdf-card-progress")).toBeNull();
  });

  it("o'qish boshlangan bo'lsa «Davom ettirish: N-bet» va progress chizig'i", () => {
    setup({ resumePage: 50 });
    expect(screen.getByText("Davom ettirish: 50-bet")).toBeTruthy();
    const bar = screen.getByTestId("pdf-card-progress").firstElementChild as HTMLElement;
    expect(bar.style.width).toBe("25%");
  });

  it("birinchi betda davom ettirish belgisi yo'q", () => {
    setup({ resumePage: 1 });
    expect(screen.queryByText(/Davom ettirish/)).toBeNull();
  });

  it("o'qilgan kitobda belgi va to'liq progress", () => {
    setup({ read: true, resumePage: 200 });
    expect(screen.getByTestId("pdf-read-badge")).toBeTruthy();
    expect(screen.queryByText(/Davom ettirish/)).toBeNull();
    const bar = screen.getByTestId("pdf-card-progress").firstElementChild as HTMLElement;
    expect(bar.style.width).toBe("100%");
  });

  it("hajm noma'lum bo'lsa faqat betlar soni", () => {
    setup({ book: book({ size_bytes: 0 }) });
    expect(screen.getByText("200 bet")).toBeTruthy();
  });
});

describe("readFraction", () => {
  it("0..1 oralig'ida cheklanadi", () => {
    expect(readFraction(undefined, 100, false)).toBe(0);
    expect(readFraction(50, 100, false)).toBe(0.5);
    expect(readFraction(500, 100, false)).toBe(1);
    expect(readFraction(10, 0, false)).toBe(0);
    expect(readFraction(1, 100, true)).toBe(1);
  });
});
