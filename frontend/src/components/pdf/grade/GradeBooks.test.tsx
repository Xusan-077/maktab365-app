// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import uz from "@/lib/i18n/messages/uz.json";
import type { PdfBook } from "@/lib/pdf-books/api";

const navigation = vi.hoisted(() => ({ params: new URLSearchParams() }));
vi.mock("next/navigation", () => ({ useSearchParams: () => navigation.params }));
vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/hooks/usePdfProgressMap", () => ({
  usePdfProgressMap: () => ({}),
  isBookRead: () => false,
}));

import { GradeBooks } from "./GradeBooks";

const book = (id: string, title: string, group: PdfBook["subject_group"]): PdfBook => ({
  id,
  slug: `9-sinf-${id}`,
  title: { uz: title },
  grade: 9,
  subject: id,
  subject_title: { uz: title },
  subject_group: group,
  page_count: 100,
  size_bytes: 1024,
  cover: null,
  cover_small: null,
  language: "uz",
  unverified: false,
  published_at: null,
});

const BOOKS = [
  book("algebra", "Algebra", "exact"),
  book("fizika", "Fizika", "exact"),
  book("biologiya", "Biologiya", "natural"),
];

function setup(search = "", books = BOOKS) {
  navigation.params = new URLSearchParams(search);
  window.history.replaceState(null, "", `/uz/darsliklar/9${search ? `?${search}` : ""}`);
  render(
    <NextIntlClientProvider locale="uz" messages={uz}>
      <GradeBooks books={books} grade={9} />
    </NextIntlClientProvider>,
  );
}

const titles = () =>
  within(screen.getByTestId("pdf-book-list"))
    .getAllByRole("heading", { level: 3 })
    .map((h) => h.textContent);

beforeEach(() => {
  navigation.params = new URLSearchParams();
});
afterEach(cleanup);

describe("GradeBooks", () => {
  it("tablar sonlari bilan; boshida hammasi ko'rinadi", () => {
    setup();
    expect(titles()).toEqual(["Algebra", "Fizika", "Biologiya"]);
    expect(screen.getByTestId("grade-tab-all").textContent).toContain("3");
    expect(screen.getByTestId("grade-tab-exact").textContent).toContain("2");
    expect(screen.getByTestId("grade-tab-natural").textContent).toContain("1");
    // Bo'sh guruh tabi o'chirilgan
    expect((screen.getByTestId("grade-tab-arts") as HTMLButtonElement).disabled).toBe(true);
  });

  it("tab tanlansa ro'yxat filtrlanadi va URL (?guruh=) yangilanadi", () => {
    setup();
    fireEvent.click(screen.getByTestId("grade-tab-natural"));
    expect(titles()).toEqual(["Biologiya"]);
    expect(window.location.search).toBe("?guruh=tabiiy");
    expect(screen.getByTestId("grade-tab-natural").getAttribute("aria-pressed")).toBe("true");
  });

  it("qidiruv nom bo'yicha filtrlaydi va URL'ga q yozadi; tozalash hammasini qaytaradi", () => {
    setup();
    fireEvent.change(screen.getByTestId("grade-search"), { target: { value: "fiz" } });
    expect(titles()).toEqual(["Fizika"]);
    expect(window.location.search).toBe("?q=fiz");

    fireEvent.click(screen.getByTestId("grade-clear"));
    expect(titles()).toHaveLength(3);
    expect(window.location.search).toBe("");
  });

  it("URL'dagi filtr boshlang'ich holat bo'ladi", () => {
    setup("guruh=aniq&q=alg");
    expect(titles()).toEqual(["Algebra"]);
    expect((screen.getByTestId("grade-search") as HTMLInputElement).value).toBe("alg");
  });

  it("natija yo'q bo'lsa bo'sh holat va «Filtrlarni tozalash»", () => {
    setup();
    fireEvent.change(screen.getByTestId("grade-search"), { target: { value: "yo'q kitob" } });
    expect(screen.queryByTestId("pdf-book-list")).toBeNull();
    expect(screen.getByText(uz.pdfBooks.grade.emptyFiltered)).toBeTruthy();
    expect(screen.getAllByText(uz.pdfBooks.grade.clear).length).toBeGreaterThan(0);
  });

  it("sinfda kitob bo'lmasa — boshqa sinflarga havola", () => {
    setup("", []);
    expect(screen.getByText(uz.pdfBooks.grade.empty.replace("{grade}", "9"))).toBeTruthy();
    const link = screen.getByRole("link", { name: uz.pdfBooks.grade.otherGrades });
    expect(link.getAttribute("href")).toBe("/darsliklar");
  });
});
