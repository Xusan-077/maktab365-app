import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/types";
import {
  bodyLimitFor,
  changesPublicContent,
  declaresTooLargeBody,
  isPdfFilePath,
  isSameOrigin,
  MAX_BODY_BYTES,
  MAX_PDF_BODY_BYTES,
  toBffUrl,
  upstreamPath,
} from "./request-guards";
import { errorCodeOf } from "./client";
import { signInErrorCode } from "./sign-in-errors";

const req = (method: string, headers: Record<string, string> = {}) =>
  new Request("http://localhost:3000/api/backend/api/v1/me/", { method, headers });

describe("BFF", () => {
  it("faqat /api/v1/ yo'llarini uzatadi", () => {
    expect(upstreamPath("/api/backend/api/v1/me/")).toBe("/api/v1/me/");
    expect(upstreamPath("/api/backend/api/v1/me")).toBe("/api/v1/me/");
    expect(toBffUrl("http://x.uz/api/backend/api/v1/me/?a=1")).toBe(
      "http://x.uz/api/backend/api/v1/me?a=1",
    );
    expect(toBffUrl("http://api.test/api/v1/me/")).toBe("http://api.test/api/v1/me/");
    expect(upstreamPath("/api/backend/admin/")).toBeNull();
    expect(upstreamPath("/api/backend/api/v1/../../admin/")).toBeNull();
    expect(upstreamPath("/other/api/v1/me/")).toBeNull();
  });

  it("o'zgartiruvchi so'rov boshqa saytdan bo'lsa rad etadi (CSRF)", () => {
    expect(isSameOrigin(req("GET", { "sec-fetch-site": "cross-site" }))).toBe(true);
    expect(isSameOrigin(req("POST", { "sec-fetch-site": "same-origin" }))).toBe(true);
    expect(isSameOrigin(req("POST", { "sec-fetch-site": "cross-site" }))).toBe(false);
    expect(
      isSameOrigin(req("DELETE", { origin: "https://evil.test", host: "localhost:3000" })),
    ).toBe(false);
    expect(
      isSameOrigin(req("PATCH", { origin: "http://localhost:3000", host: "localhost:3000" })),
    ).toBe(true);
  });
});

describe("BFF: ochiq kontent keshi", () => {
  it("faqat muvaffaqiyatli admin yozuvi keshni eskiradi", () => {
    expect(changesPublicContent("POST", "/api/v1/admin/topics/1/transition/", 200)).toBe(true);
    expect(changesPublicContent("PATCH", "/api/v1/admin/books/1/", 200)).toBe(true);
    expect(changesPublicContent("DELETE", "/api/v1/admin/books/1/", 204)).toBe(true);
    expect(changesPublicContent("GET", "/api/v1/admin/books/", 200)).toBe(false);
    expect(changesPublicContent("POST", "/api/v1/admin/books/", 400)).toBe(false);
    expect(changesPublicContent("POST", "/api/v1/me/progress/", 200)).toBe(false);
  });
});

describe("BFF: tana hajmi chegarasi", () => {
  const PDF_PATH = "/api/v1/admin/pdf-books/3f2b8c1e-5d4a-4c7e-9a10-0b6f1d2e3c4d/upload/";

  it("PDF yuklash yo'lida katta chegara, boshqa yo'llarda kichik", () => {
    expect(bodyLimitFor(PDF_PATH)).toBe(MAX_PDF_BODY_BYTES);
    expect(bodyLimitFor("/api/v1/admin/uploads/")).toBe(MAX_BODY_BYTES);
    expect(bodyLimitFor("/api/v1/admin/pdf-books/3f2b8c1e-5d4a-4c7e-9a10-0b6f1d2e3c4d/")).toBe(
      MAX_BODY_BYTES,
    );
    expect(bodyLimitFor("/api/v1/admin/pdf-books/../upload/")).toBe(MAX_BODY_BYTES);
  });

  it("PDF fayl endpoint'i faqat aniq yo'lda tanib olinadi", () => {
    const id = "3f2b8c1e-5d4a-4c7e-9a10-0b6f1d2e3c4d";
    expect(isPdfFilePath(`/api/v1/pdf-books/${id}/file/`)).toBe(true);
    expect(isPdfFilePath(`/api/v1/pdf-books/${id}/file-url/`)).toBe(false);
    expect(isPdfFilePath(`/api/v1/pdf-books/${id}/`)).toBe(false);
  });

  it("e'lon qilingan Content-Length chegaradan oshsa rad etadi", () => {
    const withLength = (length: number) =>
      new Request("http://localhost:3000/api/backend/x", {
        method: "POST",
        headers: { "content-length": String(length) },
        body: "x",
      });
    expect(declaresTooLargeBody(withLength(MAX_BODY_BYTES + 1), "/api/v1/me/")).toBe(true);
    expect(declaresTooLargeBody(withLength(MAX_BODY_BYTES), "/api/v1/me/")).toBe(false);
    expect(declaresTooLargeBody(withLength(MAX_BODY_BYTES + 1), PDF_PATH)).toBe(false);
    expect(declaresTooLargeBody(withLength(5 * 1024 ** 3), PDF_PATH)).toBe(false);
  });
});

describe("xato kodlari", () => {
  const validation = (details: Record<string, string[]>) =>
    new ApiError("bad", 400, { code: "validation_error", details });

  it("signIn: maydon xatosidan bitta kod (avval email)", () => {
    expect(signInErrorCode(validation({ password: ["password_too_common"] }))).toBe(
      "password_too_common",
    );
    expect(
      signInErrorCode(validation({ email: ["email_taken"], password: ["password_too_short"] })),
    ).toBe("email_taken");
    expect(signInErrorCode(validation({ email: ["Enter a valid email address."] }))).toBe(
      "validation_error",
    );
    expect(signInErrorCode(new ApiError("x", 401, { code: "invalid_credentials" }))).toBe(
      "invalid_credentials",
    );
    expect(signInErrorCode(new Error("boom"))).toBe("unknown");
  });

  it("klient: ApiError dan i18n kodi", () => {
    expect(errorCodeOf(validation({ current_password: ["invalid_password"] }))).toBe(
      "invalid_password",
    );
    expect(errorCodeOf(new ApiError("x", 400, { code: "token_expired" }))).toBe("token_expired");
    expect(errorCodeOf("nope")).toBe("unknown");
  });
});
