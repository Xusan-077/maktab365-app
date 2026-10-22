import { describe, expect, it, vi } from "vitest";
import { mergePdfGuestData, PDF_MERGE_CHUNK, toGuestItems } from "./guest-merge";

const position = (page: number) => ({ page, updatedAt: "2026-01-02T10:00:00.000Z" });

describe("mergePdfGuestData", () => {
  it("mehmon pozitsiyalarini merge-guest-data formatida yuboradi va tozalaydi", async () => {
    const api = { mergeGuest: vi.fn().mockResolvedValue({ pdf_progress: 1, failed: [] }) };
    const onMerged = vi.fn();

    const outcome = await mergePdfGuestData({
      api,
      load: async () => ({ "book-1": position(7) }),
      onMerged,
    });

    expect(outcome).toBe("merged");
    expect(api.mergeGuest).toHaveBeenCalledWith([
      { pdf_book_id: "book-1", last_page: 7, updated_at: "2026-01-02T10:00:00.000Z" },
    ]);
    expect(onMerged).toHaveBeenCalledTimes(1);
  });

  it("ma'lumot yo'q bo'lsa so'rov yubormaydi", async () => {
    const api = { mergeGuest: vi.fn() };
    const onMerged = vi.fn();

    expect(await mergePdfGuestData({ api, load: async () => ({}), onMerged })).toBe("empty");
    expect(api.mergeGuest).not.toHaveBeenCalled();
    expect(onMerged).not.toHaveBeenCalled();
  });

  it("xatoda ma'lumot tozalanmaydi (keyingi urinishda qayta yuboriladi)", async () => {
    const api = { mergeGuest: vi.fn().mockRejectedValue(new Error("offline")) };
    const onMerged = vi.fn();

    const outcome = await mergePdfGuestData({
      api,
      load: async () => ({ a: position(2) }),
      onMerged,
    });

    expect(outcome).toBe("failed");
    expect(onMerged).not.toHaveBeenCalled();
  });

  it("katta ro'yxatni server limitiga mos bo'laklarga bo'ladi", async () => {
    const api = { mergeGuest: vi.fn().mockResolvedValue({ pdf_progress: 0, failed: [] }) };
    const positions = Object.fromEntries(
      Array.from({ length: PDF_MERGE_CHUNK + 5 }, (_, i) => [`b${i}`, position(1)]),
    );

    await mergePdfGuestData({ api, load: async () => positions, onMerged: vi.fn() });

    expect(api.mergeGuest.mock.calls.map(([chunk]) => chunk.length)).toEqual([PDF_MERGE_CHUNK, 5]);
    expect(toGuestItems(positions)).toHaveLength(PDF_MERGE_CHUNK + 5);
  });
});
