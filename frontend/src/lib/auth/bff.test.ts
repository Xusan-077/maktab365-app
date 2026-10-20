import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/types";
import { isSameOrigin, toBffUrl, upstreamPath } from "./request-guards";
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
