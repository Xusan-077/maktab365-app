import { describe, expect, it, vi } from "vitest";
import { mergePdfGuestData, PDF_MERGE_CHUNK, toGuestItems } from "./guest-merge";

const position = (page: number) => ({ page, updatedAt: "2026-01-02T10:00:00.000Z" });
const merged = { pdf_progress: 1, pdf_bookmarks: 1, failed: [] };

describe("mergePdfGuestData", () => {
  it("pozitsiya va xatcho'plarni merge-guest-data formatida yuboradi va tozalaydi", async () => {
    const api = { mergeGuest: vi.fn().mockResolvedValue(merged) };
    const onMerged = vi.fn();

    const outcome = await mergePdfGuestData({
      api,
      load: async () => ({ positions: { "book-1": position(7) }, bookmarks: ["book-2"] }),
      onMerged,
    });

    expect(outcome).toBe("merged");
    expect(api.mergeGuest).toHaveBeenCalledWith({
      progress: [{ pdf_book_id: "book-1", last_page: 7, updated_at: "2026-01-02T10:00:00.000Z" }],
      bookmarks: ["book-2"],
    });
    expect(onMerged).toHaveBeenCalledTimes(1);
  });

  it("faqat xatcho'p bo'lsa ham yuboradi", async () => {
    const api = { mergeGuest: vi.fn().mockResolvedValue(merged) };

    const outcome = await mergePdfGuestData({
      api,
      load: async () => ({ positions: {}, bookmarks: ["b"] }),
      onMerged: vi.fn(),
    });

    expect(outcome).toBe("merged");
    expect(api.mergeGuest).toHaveBeenCalledWith({ progress: [], bookmarks: ["b"] });
  });

  it("ma'lumot yo'q bo'lsa so'rov yubormaydi", async () => {
    const api = { mergeGuest: vi.fn() };
    const onMerged = vi.fn();

    expect(
      await mergePdfGuestData({
        api,
        load: async () => ({ positions: {}, bookmarks: [] }),
        onMerged,
      }),
    ).toBe("empty");
    expect(api.mergeGuest).not.toHaveBeenCalled();
    expect(onMerged).not.toHaveBeenCalled();
  });

  it("xatoda ma'lumot tozalanmaydi (keyingi urinishda qayta yuboriladi)", async () => {
    const api = { mergeGuest: vi.fn().mockRejectedValue(new Error("offline")) };
    const onMerged = vi.fn();

    const outcome = await mergePdfGuestData({
      api,
      load: async () => ({ positions: { a: position(2) }, bookmarks: [] }),
      onMerged,
    });

    expect(outcome).toBe("failed");
    expect(onMerged).not.toHaveBeenCalled();
  });

  it("katta ro'yxatni server limitiga mos bo'laklarga bo'ladi", async () => {
    const api = { mergeGuest: vi.fn().mockResolvedValue({ ...merged, pdf_progress: 0 }) };
    const positions = Object.fromEntries(
      Array.from({ length: PDF_MERGE_CHUNK + 5 }, (_, i) => [`b${i}`, position(1)]),
    );

    await mergePdfGuestData({
      api,
      load: async () => ({ positions, bookmarks: [] }),
      onMerged: vi.fn(),
    });

    expect(api.mergeGuest.mock.calls.map(([chunk]) => chunk.progress.length)).toEqual([
      PDF_MERGE_CHUNK,
      5,
    ]);
    expect(toGuestItems(positions)).toHaveLength(PDF_MERGE_CHUNK + 5);
  });
});
