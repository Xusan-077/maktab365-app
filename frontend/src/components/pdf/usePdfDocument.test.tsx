// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PdfLoadTimeoutError } from "@/lib/pdf/load-error";
import { PDF_LOAD_TIMEOUT_MS, usePdfDocument } from "./usePdfDocument";

const pdf = vi.hoisted(() => ({
  /** Har `getDocument` chaqiruvi shu navbatdagi natijani oladi (yo'q bo'lsa — osilib qoladi). */
  results: [] as Array<{ ok: unknown } | { fail: unknown }>,
  calls: 0,
  fileUrl: vi.fn(async () => ({ url: "https://files.test/book.pdf?sig=1" })),
}));

vi.mock("@/lib/pdf/pdfjs", () => ({
  pdfjsAssetOptions: () => ({}),
  loadPdfjs: async () => ({
    getDocument: () => {
      pdf.calls += 1;
      const next = pdf.results.shift();
      const promise =
        next === undefined
          ? new Promise(() => undefined)
          : "ok" in next
            ? Promise.resolve(next.ok)
            : Promise.reject(next.fail);
      return { promise, destroy: async () => undefined };
    },
  }),
}));
vi.mock("@/lib/offline/pdf-cache", () => ({ loadOfflinePdf: async () => null }));
vi.mock("@/lib/pdf-books/api", () => ({ getPdfBooksApi: () => ({ fileUrl: pdf.fileUrl }) }));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
const settle = () => act(async () => void (await vi.advanceTimersByTimeAsync(0)));

beforeEach(() => {
  vi.useFakeTimers();
  pdf.results = [];
  pdf.calls = 0;
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("usePdfDocument: tushunarli xatolar", () => {
  it("PDF 30 s da ochilmasa — timeout xatosi (skelet cheksiz aylanmaydi)", async () => {
    const { result } = renderHook(() => usePdfDocument("b1"), { wrapper });
    await settle();
    expect(result.current.loading).toBe(true);
    await act(async () => void (await vi.advanceTimersByTimeAsync(PDF_LOAD_TIMEOUT_MS)));
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeInstanceOf(PdfLoadTimeoutError);
  });

  it("imzolangan URL eskirgan (403) — bir marta jim, yangi URL bilan qayta ochiladi", async () => {
    const doc = { numPages: 3 };
    pdf.results = [
      { fail: Object.assign(new Error("x"), { name: "ResponseException", status: 403 }) },
      { ok: doc },
    ];
    const { result } = renderHook(() => usePdfDocument("b1"), { wrapper });
    await settle();
    await settle();
    expect(pdf.calls).toBe(2);
    expect(pdf.fileUrl).toHaveBeenCalledTimes(2);
    expect(result.current.error).toBeNull();
    expect(result.current.doc).toBe(doc);
  });

  it("ikkinchi marta ham rad etilsa — xato ko'rsatiladi (cheksiz takror yo'q)", async () => {
    const denied = () => Object.assign(new Error("x"), { name: "ResponseException", status: 403 });
    pdf.results = [{ fail: denied() }, { fail: denied() }];
    const { result } = renderHook(() => usePdfDocument("b1"), { wrapper });
    await settle();
    await settle();
    expect(pdf.calls).toBe(2);
    expect(result.current.error).toMatchObject({ name: "ResponseException" });
  });

  it("xatodan keyin internet qaytsa — o'zi qayta yuklanadi", async () => {
    const doc = { numPages: 3 };
    pdf.results = [{ fail: new TypeError("Failed to fetch") }, { ok: doc }];
    const { result } = renderHook(() => usePdfDocument("b1"), { wrapper });
    await settle();
    expect(result.current.error).toBeInstanceOf(TypeError);
    act(() => void window.dispatchEvent(new Event("online")));
    await settle();
    await settle();
    expect(pdf.calls).toBe(2);
    expect(result.current.doc).toBe(doc);
  });
});
