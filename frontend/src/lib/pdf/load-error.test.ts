import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/types";
import { autoRetriable, classifyPdfError, PdfLoadTimeoutError } from "./load-error";

const pdfjsError = (name: string, extra: Record<string, unknown> = {}) =>
  Object.assign(new Error("x"), { name, ...extra });

describe("classifyPdfError", () => {
  it("internet yo'q — har qanday xatodan ustun", () => {
    expect(classifyPdfError(new TypeError("Failed to fetch"), false)).toBe("offline");
  });

  it("API (imzolangan URL olish) xatolari", () => {
    expect(classifyPdfError(new ApiError("x", 0, { code: "timeout" }))).toBe("timeout");
    expect(classifyPdfError(new ApiError("x", 0, { code: "network_error" }))).toBe("network");
    expect(classifyPdfError(new ApiError("x", 404, { code: "not_found" }))).toBe("notFound");
    expect(classifyPdfError(new ApiError("x", 403, { code: "forbidden" }))).toBe("forbidden");
    expect(classifyPdfError(new ApiError("x", 401, { code: "not_authenticated" }))).toBe(
      "forbidden",
    );
    expect(classifyPdfError(new ApiError("x", 503, { code: "server_error" }))).toBe("server");
    expect(classifyPdfError(new ApiError("x", 429, { code: "throttled" }))).toBe("server");
  });

  it("pdf.js javob xatolari: fayl yo'q, imzo eskirgan, server", () => {
    expect(classifyPdfError(pdfjsError("ResponseException", { status: 404, missing: true }))).toBe(
      "notFound",
    );
    expect(classifyPdfError(pdfjsError("ResponseException", { status: 403 }))).toBe("expired");
    expect(classifyPdfError(pdfjsError("ResponseException", { status: 500 }))).toBe("server");
    expect(classifyPdfError(pdfjsError("ResponseException", { status: 0 }))).toBe("network");
    expect(classifyPdfError(pdfjsError("MissingPDFException"))).toBe("notFound");
  });

  it("buzilgan / PDF emas / parolli fayl", () => {
    for (const name of ["InvalidPDFException", "FormatError", "PasswordException"]) {
      expect(classifyPdfError(pdfjsError(name))).toBe("damaged");
    }
  });

  it("vaqt tugashi, fetch xatosi va noma'lum", () => {
    expect(classifyPdfError(new PdfLoadTimeoutError())).toBe("timeout");
    expect(classifyPdfError(new TypeError("Load failed"))).toBe("network");
    expect(classifyPdfError(new Error("boom"))).toBe("unknown");
    expect(classifyPdfError(null)).toBe("unknown");
  });

  it("faqat eskirgan havola jim qayta uriniladi", () => {
    expect(autoRetriable("expired")).toBe(true);
    expect(autoRetriable("damaged")).toBe(false);
    expect(autoRetriable("network")).toBe(false);
  });
});
