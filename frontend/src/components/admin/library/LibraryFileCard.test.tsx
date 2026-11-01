// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { AdminBook } from "@/lib/library/admin-api";
import { ApiError } from "@/lib/api/types";
import uz from "@/lib/i18n/messages/uz.json";

const upload = vi.hoisted(() => ({
  state: { phase: "idle", progress: 0, error: null } as unknown,
}));
vi.mock("./useBookPdfUpload", () => ({
  useBookPdfUpload: () => ({ state: upload.state, run: vi.fn(), cancel: vi.fn() }),
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

afterEach(() => {
  cleanup();
  upload.state = { phase: "idle", progress: 0, error: null };
});

describe("LibraryFileCard: sekin ochilish ogohlantirishi", () => {
  it("linearize qilinmagan katta PDF uchun ogohlantirish ko'rsatadi", () => {
    setup(book({ open_warning: true }));
    expect(screen.getByRole("status").textContent).toBe(uz.admin.library.file.slowOpen);
  });

  it("ogohlantirish bo'lmasa ko'rsatmaydi", () => {
    setup(book());
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("tekshiruv vaqti tugasa (timeout yoki 504) katta fayl haqida aniq xabar beradi", () => {
    for (const error of [new ApiError("x", 0, { code: "timeout" }), new ApiError("x", 504)]) {
      upload.state = { phase: "error", progress: 0, error };
      setup(book());
      expect(screen.getByRole("alert").textContent).toBe(uz.admin.library.file.processingTimeout);
      cleanup();
    }
  });
});
