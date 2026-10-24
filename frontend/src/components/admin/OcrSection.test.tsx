// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import type { AdminPdfBook } from "@/lib/admin/types";
import uz from "@/lib/i18n/messages/uz.json";

const api = vi.hoisted(() => ({ pdfBook: vi.fn(), requestOcr: vi.fn() }));
vi.mock("@/lib/admin/api", () => ({ getAdminApi: () => api }));

import { OcrSection } from "./OcrSection";

const t = uz.admin.ocr;

const book = (over: Partial<AdminPdfBook> = {}) =>
  ({
    id: "b1",
    has_file: true,
    has_text_layer: false,
    ocr_status: "none",
    ocr_error: "",
    ocr_updated_at: null,
    ocr_available: true,
    ...over,
  }) as AdminPdfBook;

function setup(initial: AdminPdfBook) {
  api.pdfBook.mockResolvedValue(initial);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <NextIntlClientProvider locale="uz" messages={uz}>
      <QueryClientProvider client={client}>
        <OcrSection book={initial} />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("OcrSection", () => {
  it("matn qatlami bor: holat yoziladi, OCR tugmasi yo'q", () => {
    setup(book({ has_text_layer: true }));

    expect(screen.getByTestId("text-layer-status").textContent).toBe(t.textLayer.yes);
    expect(screen.queryByTestId("ocr-request")).toBeNull();
  });

  it("hali tekshirilmagan: tugma yo'q; fayl yo'q bo'lsa bo'lim ko'rinmaydi", () => {
    setup(book({ has_text_layer: null }));
    expect(screen.getByTestId("text-layer-status").textContent).toBe(t.textLayer.unknown);
    expect(screen.queryByTestId("ocr-request")).toBeNull();
    cleanup();

    setup(book({ has_file: false }));
    expect(screen.queryByTestId("ocr-section")).toBeNull();
  });

  it("skanerlangan kitob: «OCR qilish» so'rov yuboradi va holat «Navbatda» bo'ladi", async () => {
    setup(book());
    api.requestOcr.mockResolvedValue(book({ ocr_status: "queued" }));

    fireEvent.click(screen.getByTestId("ocr-request"));

    await waitFor(() => expect(screen.getByTestId("ocr-status").textContent).toBe(t.status.queued));
    expect(api.requestOcr).toHaveBeenCalledWith("b1");
    expect((screen.getByTestId("ocr-request") as HTMLButtonElement).disabled).toBe(true);
  });

  it("OCR serverda yoqilmagan: tugma o'chiq va izoh ko'rsatiladi", () => {
    setup(book({ ocr_available: false }));

    expect((screen.getByTestId("ocr-request") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(t.unavailable)).toBeTruthy();
  });

  it("muvaffaqiyatsiz: xato matni va «Qayta OCR qilish»", () => {
    setup(
      book({
        ocr_status: "failed",
        ocr_error: "ocr_not_implemented",
        ocr_updated_at: "2026-10-24T18:03:10Z",
      }),
    );

    expect(screen.getByTestId("ocr-error").textContent).toBe(t.errors.ocr_not_implemented);
    expect(screen.getByTestId("ocr-request").textContent).toContain(t.retry);
    expect(screen.getByText("24-okt, 23:03")).toBeTruthy();
  });
});
