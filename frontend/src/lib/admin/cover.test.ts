import { describe, expect, it, vi } from "vitest";
import { applyCover, coverImageProblem, COVER_MAX_BYTES } from "./cover";

vi.mock("@/lib/pdf/thumbnail", () => ({
  renderCover: vi.fn(async () => new File(["x"], "cover.webp", { type: "image/webp" })),
}));

const png = (size = 10) => new File([new Uint8Array(size)], "a.png", { type: "image/png" });

describe("coverImageProblem", () => {
  it("accepts JPG/PNG/WebP within the size limit", () => {
    expect(coverImageProblem(png())).toBeNull();
    expect(coverImageProblem(new File(["x"], "a.webp", { type: "image/webp" }))).toBeNull();
  });
  it("rejects other types and oversize files", () => {
    expect(coverImageProblem(new File(["x"], "a.gif", { type: "image/gif" }))).toBe("type");
    expect(coverImageProblem(new File(["x"], "a.svg", { type: "image/svg+xml" }))).toBe("type");
    expect(coverImageProblem(png(COVER_MAX_BYTES + 1))).toBe("size");
  });
});

describe("applyCover", () => {
  const api = () => ({
    upload: vi.fn(async () => ({ path: "covers/x.webp" })),
    updatePdfBook: vi.fn(async () => ({})),
  });

  it("auto only switches the mode (no upload)", async () => {
    const a = api();
    await applyCover(a as never, "b1", { mode: "auto", image: null });
    expect(a.upload).not.toHaveBeenCalled();
    expect(a.updatePdfBook).toHaveBeenCalledWith("b1", { cover_mode: "auto" });
  });

  it("custom uploads the chosen image then patches mode and path", async () => {
    const a = api();
    await applyCover(a as never, "b1", { mode: "custom", image: png() });
    expect(a.upload).toHaveBeenCalledWith(expect.any(File), "cover");
    expect(a.updatePdfBook).toHaveBeenCalledWith("b1", {
      cover_mode: "custom",
      cover: "covers/x.webp",
    });
  });

  it("first_page renders the PDF cover", async () => {
    const a = api();
    await applyCover(
      a as never,
      "b1",
      { mode: "first_page", image: null },
      { url: "https://r2/x" },
    );
    expect(a.updatePdfBook).toHaveBeenCalledWith("b1", {
      cover_mode: "first_page",
      cover: "covers/x.webp",
    });
  });

  it("requires an image for custom and a source for first_page", async () => {
    await expect(
      applyCover(api() as never, "b", { mode: "custom", image: null }),
    ).rejects.toThrow();
    await expect(
      applyCover(api() as never, "b", { mode: "first_page", image: null }),
    ).rejects.toThrow();
  });
});
