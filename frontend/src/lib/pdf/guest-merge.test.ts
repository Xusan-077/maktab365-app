import { describe, expect, it, vi } from "vitest";
import {
  MERGE_RETRY_MAX_MS,
  mergePdfGuestData,
  mergeRetryDelay,
  PDF_MERGE_CHUNK,
  toGuestItems,
} from "./guest-merge";

const position = (page: number) => ({ page, updatedAt: "2026-01-02T10:00:00.000Z" });
const merged = { pdf_progress: 1, pdf_bookmarks: 1, pdf_annotations: 0, failed: [] };

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
      annotations: [],
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
    expect(api.mergeGuest).toHaveBeenCalledWith({
      progress: [],
      bookmarks: ["b"],
      annotations: [],
    });
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

  it("qayta urinish: xatodan keyin o'sha ma'lumot yuboriladi va faqat muvaffaqiyatda tozalanadi", async () => {
    const api = {
      mergeGuest: vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(merged),
    };
    const onMerged = vi.fn();
    const options = {
      api,
      load: async () => ({ positions: { a: position(4) }, bookmarks: ["b"] }),
      onMerged,
    };

    expect(await mergePdfGuestData(options)).toBe("failed");
    expect(onMerged).not.toHaveBeenCalled();

    expect(await mergePdfGuestData(options)).toBe("merged");
    expect(onMerged).toHaveBeenCalledTimes(1);
    expect(api.mergeGuest).toHaveBeenCalledTimes(2);
    expect(api.mergeGuest.mock.calls[1]).toEqual(api.mergeGuest.mock.calls[0]); // bir xil yuklama
  });

  it("bo'laklardan biri yiqilsa hech narsa tozalanmaydi (idempotent qayta yuborish)", async () => {
    const api = {
      mergeGuest: vi.fn().mockResolvedValueOnce(merged).mockRejectedValueOnce(new Error("500")),
    };
    const positions = Object.fromEntries(
      Array.from({ length: PDF_MERGE_CHUNK + 1 }, (_, i) => [`b${i}`, position(1)]),
    );
    const onMerged = vi.fn();

    expect(
      await mergePdfGuestData({ api, load: async () => ({ positions, bookmarks: [] }), onMerged }),
    ).toBe("failed");
    expect(onMerged).not.toHaveBeenCalled();
  });
});

describe("mergeRetryDelay", () => {
  it("oraliq oshib boradi va 5 daqiqadan oshmaydi", () => {
    expect([1, 2, 3].map(mergeRetryDelay)).toEqual([5_000, 15_000, 45_000]);
    expect(mergeRetryDelay(50)).toBe(MERGE_RETRY_MAX_MS);
  });
});

describe("mergePdfGuestData: belgilar", () => {
  const note = {
    id: "4f2a8f0e-8f4f-4a54-9d6a-0b5f2f5b1c11",
    pdf_book_id: "book-1",
    page: 3,
    color: "green" as const,
    rects: [{ x: 0.1, y: 0.1, w: 0.2, h: 0.05 }],
    note: "Muhim",
  };

  it("faqat belgi bo'lsa ham yuboradi va muvaffaqiyatda tozalashga chaqiradi", async () => {
    const api = { mergeGuest: vi.fn().mockResolvedValue({ ...merged, pdf_annotations: 1 }) };
    const onMerged = vi.fn();
    const outcome = await mergePdfGuestData({
      api,
      load: async () => ({ positions: {}, bookmarks: [], annotations: [note] }),
      onMerged,
    });
    expect(outcome).toBe("merged");
    expect(api.mergeGuest).toHaveBeenCalledWith({
      progress: [],
      bookmarks: [],
      annotations: [note],
    });
    expect(onMerged).toHaveBeenCalledTimes(1);
  });

  it("xatoda belgilar saqlanadi", async () => {
    const api = { mergeGuest: vi.fn().mockRejectedValue(new Error("offline")) };
    const onMerged = vi.fn();
    const outcome = await mergePdfGuestData({
      api,
      load: async () => ({ positions: {}, bookmarks: [], annotations: [note] }),
      onMerged,
    });
    expect(outcome).toBe("failed");
    expect(onMerged).not.toHaveBeenCalled();
  });
});
