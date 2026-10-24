// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import uz from "@/lib/i18n/messages/uz.json";
import type { PdfProgressEntry } from "@/hooks/usePdfProgressMap";

let map: Record<string, PdfProgressEntry> = {};
vi.mock("@/hooks/usePdfProgressMap", async () => {
  const { mergeReadStatus } = await import("@/lib/pdf/progress");
  return {
    usePdfProgressMap: () => map,
    isBookRead: (entry: PdfProgressEntry | undefined, total: number) =>
      entry !== undefined && mergeReadStatus(entry.status, entry.page, total) === "read",
  };
});

import { BookCoverProgress, BookMetaProgress } from "./BookProgress";

function setup(entries: Record<string, PdfProgressEntry>) {
  map = entries;
  return render(
    <NextIntlClientProvider locale="uz" messages={uz}>
      <div data-testid="root">
        <BookCoverProgress bookId="b1" pageCount={200} />
        <BookMetaProgress bookId="b1" pageCount={200} />
      </div>
    </NextIntlClientProvider>,
  );
}

afterEach(cleanup);

describe("BookProgress", () => {
  it("o'qilmagan kitobda hech narsa chiqmaydi", () => {
    setup({});
    expect(screen.getByTestId("root").textContent).toBe("");
    expect(screen.getByTestId("root").querySelector("span")).toBeNull();
  });

  it("boshlangan kitobda chiziq (ulush) va bet raqami", () => {
    setup({ b1: { page: 90, status: null } });
    expect(screen.getByText(/90-bet/)).toBeTruthy();
    const bar = screen.getByTestId("root").querySelector("span > span") as HTMLElement;
    expect(bar.style.width).toBe("45%");
  });

  it("o'qilgan kitobda ✓ O'qilgan", () => {
    setup({ b1: { page: 10, status: "read" } });
    expect(screen.getByText(/O'qilgan/)).toBeTruthy();
    expect(screen.queryByText(/-bet/)).toBeNull();
  });
});
