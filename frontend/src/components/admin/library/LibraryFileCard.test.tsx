// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { AdminBook } from "@/lib/library/admin-api";
import uz from "@/lib/i18n/messages/uz.json";

vi.mock("./useBookPdfUpload", () => ({
  useBookPdfUpload: () => ({ state: { phase: "idle" }, run: vi.fn(), cancel: vi.fn() }),
}));
vi.mock("@/components/admin/useAdminErrorText", () => ({ useAdminErrorText: () => () => "" }));
vi.mock("@/hooks/useToast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

import { LibraryFileCard } from "./LibraryFileCard";

const book = (over: Partial<AdminBook> = {}) =>
  ({
    id: "b1",
    has_file: true,
    status: "ready",
    status_error: "",
    page_count: 120,
    size_bytes: 30_000_000,
    open_warning: false,
    ...over,
  }) as AdminBook;

function setup(value: AdminBook) {
  render(
    <NextIntlClientProvider locale="uz" messages={uz}>
      <LibraryFileCard book={value} />
    </NextIntlClientProvider>,
  );
}

afterEach(cleanup);

describe("LibraryFileCard: sekin ochilish ogohlantirishi", () => {
  it("linearize qilinmagan katta PDF uchun ogohlantirish ko'rsatadi", () => {
    setup(book({ open_warning: true }));
    expect(screen.getByRole("status").textContent).toBe(uz.admin.library.file.slowOpen);
  });

  it("ogohlantirish bo'lmasa ko'rsatmaydi", () => {
    setup(book());
    expect(screen.queryByRole("status")).toBeNull();
  });
});
