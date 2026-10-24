// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { PdfProgressEntry } from "@/hooks/usePdfProgressMap";
import uz from "@/lib/i18n/messages/uz.json";

let map: Record<string, PdfProgressEntry> = {};
vi.mock("@/hooks/usePdfProgressMap", async () => {
  const { mergeReadStatus } = await import("@/lib/pdf/progress");
  return {
    usePdfProgressMap: () => map,
    isBookRead: (entry: PdfProgressEntry | undefined, total: number) =>
      entry !== undefined && mergeReadStatus(entry.status, entry.page, total) === "read",
  };
});
vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { BookResumeCard, BookStickyBar } from "./BookStickyBar";

const t = uz.pdfBooks.page;
const props = { bookId: "b1", grade: 9, slug: "9-sinf-algebra", pageCount: 240 };

function setup(entries: Record<string, PdfProgressEntry>, node = <BookStickyBar {...props} />) {
  map = entries;
  return render(
    <NextIntlClientProvider locale="uz" messages={uz}>
      {node}
    </NextIntlClientProvider>,
  );
}

afterEach(cleanup);

describe("BookStickyBar (mobil)", () => {
  it("o'qilmagan kitob: «Onlayn o'qish», progress yo'q; faqat md dan kichik ekranda", () => {
    setup({});
    const bar = screen.getByTestId("book-sticky-bar");
    expect(bar.className).toContain("md:hidden");
    expect(bar.className).toContain("sticky");
    expect(bar.className).toContain("safe-area-inset-bottom");
    expect(screen.getByTestId("book-resume-link").textContent).toBe(t.read);
    expect(screen.getByTestId("book-resume-link").getAttribute("href")).toBe(
      "/darsliklar/9/9-sinf-algebra/oqish",
    );
    expect(screen.queryByTestId("book-resume-progress")).toBeNull();
  });

  it("boshlangan kitob: «32-betdan davom ettirish» va 13%", () => {
    setup({ b1: { page: 32, status: null } });
    const link = screen.getByTestId("book-resume-link");
    expect(link.textContent).toBe(t.resume.replace("{page}", "32"));
    expect(link.getAttribute("href")).toBe("/darsliklar/9/9-sinf-algebra/oqish?page=32");
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("13");
  });
});

describe("BookResumeCard (desktop o'ng ustun)", () => {
  it("progress va davom ettirish", () => {
    setup({ b1: { page: 120, status: null } }, <BookResumeCard {...props} />);
    expect(screen.getByText("50%")).toBeTruthy();
    expect(screen.getByTestId("book-resume-link").textContent).toBe(
      t.resume.replace("{page}", "120"),
    );
  });
});
