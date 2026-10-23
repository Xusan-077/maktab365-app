// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook } from "@testing-library/react";

const api = vi.hoisted(() => ({ recordStat: vi.fn() }));
vi.mock("@/lib/pdf-books/api", () => ({ getPdfBooksApi: () => api }));

import { PAGE_DWELL_MS, useBookStats } from "./useBookStats";

beforeEach(() => {
  vi.useFakeTimers();
  sessionStorage.clear();
  api.recordStat.mockReset().mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useBookStats", () => {
  it("kitob ochilishi bir sessiyada bir marta yuboriladi", () => {
    const first = renderHook(() => useBookStats("b1", null));
    first.unmount();
    renderHook(() => useBookStats("b1", null));
    expect(api.recordStat).toHaveBeenCalledTimes(1);
    expect(api.recordStat).toHaveBeenCalledWith("b1", { kind: "open" });
  });

  it("sahifa faqat yetarlicha ko'rinib turgandan keyin sanaladi", () => {
    const { rerender } = renderHook(({ page }) => useBookStats("b1", page), {
      initialProps: { page: 1 },
    });
    api.recordStat.mockClear();
    vi.advanceTimersByTime(PAGE_DWELL_MS - 100);
    rerender({ page: 2 }); // tez varaqlash: 1-bet sanalmaydi
    vi.advanceTimersByTime(PAGE_DWELL_MS);
    expect(api.recordStat).toHaveBeenCalledTimes(1);
    expect(api.recordStat).toHaveBeenCalledWith("b1", { kind: "page", page: 2 });

    // Keyingi bet sanaladi, xuddi shu bet qayta ochilsa qayta sanalmaydi
    rerender({ page: 3 });
    vi.advanceTimersByTime(PAGE_DWELL_MS);
    rerender({ page: 2 });
    vi.advanceTimersByTime(PAGE_DWELL_MS);
    expect(api.recordStat).toHaveBeenCalledWith("b1", { kind: "page", page: 3 });
    expect(api.recordStat).toHaveBeenCalledTimes(2);
  });

  it("xato bo'lsa o'qishga ta'sir qilmaydi", () => {
    api.recordStat.mockRejectedValue(new Error("offline"));
    expect(() => renderHook(() => useBookStats("b9", 1))).not.toThrow();
  });

  it("kitob yo'q bo'lsa hech narsa yuborilmaydi", () => {
    renderHook(() => useBookStats(undefined, 1));
    vi.advanceTimersByTime(PAGE_DWELL_MS * 2);
    expect(api.recordStat).not.toHaveBeenCalled();
  });
});
