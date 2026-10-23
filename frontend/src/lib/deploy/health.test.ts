import { describe, expect, it } from "vitest";
import { apiRevisionOf, isCompatible, REQUIRED_API_REVISION } from "./backend-revision";
import { buildHealth, shortCommit } from "./health";

const ok = (revision?: number, commit = "abc1234def") => ({
  status: "ok",
  checks: { database: "ok", redis: "ok" },
  version:
    revision === undefined
      ? undefined
      : { commit, api_revision: revision, environment: "production" },
});

describe("apiRevisionOf / isCompatible", () => {
  it("version yo'q (eski backend) — 1-versiya", () => {
    expect(apiRevisionOf({ status: "ok" })).toBe(1);
    expect(apiRevisionOf(null)).toBe(1);
    expect(isCompatible({ status: "ok" }, 2)).toBe(false);
  });

  it("kerakli va undan yuqori versiya mos", () => {
    expect(isCompatible(ok(2), 2)).toBe(true);
    expect(isCompatible(ok(5), 2)).toBe(true);
    expect(isCompatible(ok(1), 2)).toBe(false);
  });

  it("yaroqsiz qiymat 1-versiya hisoblanadi", () => {
    expect(apiRevisionOf({ version: { api_revision: "x" as unknown as number } })).toBe(1);
  });

  it("repo'dagi talab musbat butun son", () => {
    expect(Number.isInteger(REQUIRED_API_REVISION) && REQUIRED_API_REVISION >= 1).toBe(true);
  });
});

describe("shortCommit", () => {
  it("7 belgigacha qisqartiradi, bo'sh bo'lsa unknown", () => {
    expect(shortCommit("0123456789abcdef")).toBe("0123456");
    expect(shortCommit(undefined)).toBe("unknown");
    expect(shortCommit("  ")).toBe("unknown");
  });
});

describe("buildHealth", () => {
  const base = { commit: "feedface0000", environment: "production", required: 2 };

  it("ikkala tomon tayyor va mos — ok", () => {
    const health = buildHealth({ ...base, backend: { health: ok(2) } });
    expect(health.status).toBe("ok");
    expect(health.frontend).toEqual({
      commit: "feedfac",
      environment: "production",
      required_api_revision: 2,
    });
    expect(health.backend).toMatchObject({
      reachable: true,
      compatible: true,
      commit: "abc1234def",
      api_revision: 2,
    });
  });

  it("backend ulanmasa — degraded va sababi", () => {
    const health = buildHealth({ ...base, backend: { health: null, error: "unreachable" } });
    expect(health.status).toBe("degraded");
    expect(health.backend).toEqual({ reachable: false, error: "unreachable" });
  });

  it("backend eski versiyada — degraded, compatible=false", () => {
    const health = buildHealth({ ...base, backend: { health: ok(1) } });
    expect(health.status).toBe("degraded");
    expect(health.backend).toMatchObject({ reachable: true, compatible: false });
  });

  it("backend DB/Redis xatosida — degraded", () => {
    const health = buildHealth({
      ...base,
      backend: {
        health: { ...ok(2), status: "degraded", checks: { database: "ok", redis: "error" } },
      },
    });
    expect(health.status).toBe("degraded");
    expect(health.backend).toMatchObject({ checks: { redis: "error" } });
  });

  it("platforma o'zgaruvchilarisiz (lokal)", () => {
    const health = buildHealth({ required: 2, backend: { health: ok(2) } });
    expect(health.frontend).toMatchObject({ commit: "unknown", environment: "local" });
  });
});

describe("backend-revision.json", () => {
  it("backend API_REVISION dan oshmaydi (frontend hech qachon yo'q versiyani kutmaydi)", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync(
      new URL("../../../../backend/apps/core/version.py", import.meta.url),
      "utf8",
    );
    const backend = Number(/^API_REVISION = (\d+)$/m.exec(source)?.[1]);
    expect(backend).toBeGreaterThanOrEqual(REQUIRED_API_REVISION);
  });
});
