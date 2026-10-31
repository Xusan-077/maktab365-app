// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Book } from "@/lib/books/api";
import uz from "@/lib/i18n/messages/uz.json";

vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { BookCard } from "./BookCard";

const book = (over: Partial<Book> = {}): Book => ({
  id: "11111111-1111-4111-8111-111111111111",
  title: "O'tkan kunlar",
  author: "Abdulla Qodiriy",
  type: "fiction",
  grade_level: null,
  language: "uz",
  page_count: 320,
  cover: null,
  created_at: "2026-10-01T00:00:00Z",
  ...over,
});

function setup(over: Partial<Book> = {}) {
  render(
    <NextIntlClientProvider locale="uz" messages={uz}>
      <BookCard book={book(over)} />
    </NextIntlClientProvider>,
  );
}

afterEach(cleanup);

describe("BookCard", () => {
  it("kitob sahifasiga havola, nom, muallif, tur va betlar soni", () => {
    setup();
    const card = screen.getByTestId("book-card");
    expect(card.getAttribute("href")).toBe("/kitoblar/11111111-1111-4111-8111-111111111111");
    expect(card.textContent).toContain("O'tkan kunlar");
    expect(card.textContent).toContain("Abdulla Qodiriy");
    expect(card.textContent).toContain("Badiiy kitob · 320 bet");
  });

  it("muqova rasmi bo'lmasa tur rangidagi zaxira muqova, nisbat 2:3", () => {
    setup();
    const fallback = screen.getByTestId("book-cover-fallback");
    expect(fallback.parentElement?.className).toContain("aspect-[2/3]");
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("muallifsiz kitobda muallif qatori chiqmaydi", () => {
    setup({ author: "" });
    expect(screen.getByTestId("book-card").textContent).not.toContain("Muallif");
  });
});
