import { describe, expect, it } from "vitest";
import { resolveFileUrl } from "./file-url";

describe("resolveFileUrl", () => {
  it("imzolangan S3/R2 URL'i o'zgarmaydi", () => {
    const url = "https://acc.r2.cloudflarestorage.com/b/pdf-books/x.pdf?X-Amz-Signature=abc";
    expect(resolveFileUrl(url, "http://localhost:3000")).toBe(url);
  });

  it("lokal backend yo'li BFF orqali, slash'siz", () => {
    expect(resolveFileUrl("/api/v1/pdf-books/abc/file/?token=t%3Ax", "http://localhost:3000")).toBe(
      "http://localhost:3000/api/backend/api/v1/pdf-books/abc/file?token=t%3Ax",
    );
  });
});
