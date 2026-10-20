import { beforeEach, describe, expect, it, vi } from "vitest";
import type { JWT } from "next-auth/jwt";
import type { components } from "@/lib/api/schema";
import type { RefreshResult } from "./backend";
import { REFRESH_MARGIN_MS } from "./config";
import { backendJwt, type JwtDeps } from "./jwt-callback";
import { refreshOnce, resetRefreshStore, rotatedTokens } from "./refresh";
import { jwtExpiresAt, type BackendTokens } from "./tokens";

type Me = components["schemas"]["Me"];

const NOW = 1_800_000_000_000;
const MINUTE = 60_000;

/** Imzosiz test JWT'si — faqat `exp` claim kerak. */
const fakeJwt = (expMs: number) =>
  `h.${btoa(JSON.stringify({ exp: Math.floor(expMs / 1000) }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")}.s`;

const tokens = (access: string, refresh: string, accessExpires: number): BackendTokens => ({
  access,
  refresh,
  accessExpires,
});

const me = (overrides: Partial<Me> = {}): Me => ({
  id: "u1",
  email: "ali@example.com",
  email_verified: true,
  role: "teacher",
  date_joined: "2026-01-01T00:00:00Z",
  profile: {
    display_name: "Ali",
    avatar_url: "",
    locale: "uz",
    grade: null,
    subjects: [],
    grades: [],
    onboarded_at: "2026-01-02T00:00:00Z",
  },
  ...overrides,
});

function deps(refreshResult?: RefreshResult, meResult: Me | null = me()) {
  return {
    now: () => NOW,
    refresh: vi.fn(async () => refreshResult ?? { ok: false as const, reason: "invalid" as const }),
    fetchMe: vi.fn(async () => meResult),
  } satisfies JwtDeps;
}

const session = (accessExpires: number): JWT => ({
  sub: "u1",
  backend: tokens("old-access", "old-refresh", accessExpires),
  account: { role: "student", onboarded: false, emailVerified: false },
});

describe("backendJwt", () => {
  it("kirishda backend tokenlari va akkaunt holatini yozadi", async () => {
    const backend = tokens("a", "r", NOW + 15 * MINUTE);
    const account = { role: "student" as const, onboarded: false, emailVerified: false };
    const result = await backendJwt(
      { token: { sub: "u1" }, user: { id: "u1", name: null, email: "a@b.uz", backend, account } },
      deps(),
    );
    expect(result).toMatchObject({ backend, account, email: "a@b.uz" });
  });

  it("Google sessiyasini (backend tokensiz) o'zgartirmaydi", async () => {
    const d = deps();
    const token = { sub: "g1", name: "G" };
    expect(await backendJwt({ token }, d)).toBe(token);
    expect(d.refresh).not.toHaveBeenCalled();
  });

  it("onboarding tugamaguncha har o'qishda /me/ dan holatni yangilaydi", async () => {
    const d = deps(undefined, me({ role: "student" }));
    const result = await backendJwt({ token: session(NOW + 10 * MINUTE) }, d);
    expect(d.fetchMe).toHaveBeenCalledOnce();
    expect(result?.account).toEqual({ role: "student", onboarded: true, emailVerified: true });
  });

  it("muddati uzoq bo'lsa refresh qilinmaydi (onboarding tugagan)", async () => {
    const d = deps();
    const token: JWT = {
      ...session(NOW + REFRESH_MARGIN_MS + MINUTE),
      account: { role: "student", onboarded: true, emailVerified: false },
    };
    expect(await backendJwt({ token }, d)).toBe(token);
    expect(d.refresh).not.toHaveBeenCalled();
    expect(d.fetchMe).not.toHaveBeenCalled();
  });

  it("muddati yaqinlashganda refresh qiladi va yangi juftlikni saqlaydi", async () => {
    const fresh = tokens("new-access", "new-refresh", NOW + 15 * MINUTE);
    const d = deps({ ok: true, tokens: fresh });
    const result = await backendJwt({ token: session(NOW + MINUTE) }, d);
    expect(d.refresh).toHaveBeenCalledWith("old-refresh");
    expect(result?.backend).toEqual(fresh);
    expect(result?.error).toBeUndefined();
  });

  it("access tugagan va refresh rad etilsa sessiya tugaydi (null)", async () => {
    const result = await backendJwt({ token: session(NOW - 1) }, deps());
    expect(result).toBeNull();
  });

  it("refresh rad etilsa-yu access hali amal qilsa, sessiya xato belgisi bilan qoladi", async () => {
    const result = await backendJwt({ token: session(NOW + MINUTE) }, deps());
    expect(result).toMatchObject({ error: "RefreshFailed", backend: { access: "old-access" } });
  });

  it("backend javob bermasa sessiya o'zgarmaydi (access tugagan bo'lsa ham)", async () => {
    const token = session(NOW - 1);
    const result = await backendJwt({ token }, deps({ ok: false, reason: "unavailable" }, null));
    expect(result).toBe(token);
  });

  it("update() da /me/ dan rol, onboarding va email holatini yangilaydi", async () => {
    const d = deps(undefined, me());
    const result = await backendJwt({ token: session(NOW + 10 * MINUTE), trigger: "update" }, d);
    expect(d.fetchMe).toHaveBeenCalledWith("old-access");
    expect(result).toMatchObject({
      name: "Ali",
      account: { role: "teacher", onboarded: true, emailVerified: true },
    });
  });

  it("editor/admin panelda o'qituvchi sifatida", async () => {
    const result = await backendJwt(
      { token: session(NOW + 10 * MINUTE), trigger: "update" },
      deps(undefined, me({ role: "admin" })),
    );
    expect(result?.account?.role).toBe("teacher");
  });
});

describe("refreshOnce", () => {
  beforeEach(() => resetRefreshStore());

  it("bir xil token uchun parallel chaqiruvlar bitta so'rov bo'ladi", async () => {
    const fresh = tokens("a2", "r2", NOW + 15 * MINUTE);
    const run = vi.fn(async () => ({ ok: true as const, tokens: fresh }));
    const [first, second] = await Promise.all([
      refreshOnce("r1", run, () => NOW),
      refreshOnce("r1", run, () => NOW),
    ]);
    expect(run).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
    // Keyinroq (cookie hali eski) — natija eslab qolingan.
    await refreshOnce("r1", run, () => NOW + 1000);
    expect(run).toHaveBeenCalledTimes(1);
    expect(rotatedTokens("r1", NOW + 1000)).toEqual(fresh);
  });

  it("eslab qolish muddati o'tgach qayta so'raydi", async () => {
    const run = vi.fn(async () => ({ ok: true as const, tokens: tokens("a", "r", 0) }));
    await refreshOnce("r1", run, () => NOW);
    expect(rotatedTokens("r1", NOW + 2 * MINUTE)).toBeNull();
    await refreshOnce("r1", run, () => NOW + 2 * MINUTE);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("tarmoq xatosi eslab qolinmaydi", async () => {
    const run = vi.fn(async () => ({ ok: false as const, reason: "unavailable" as const }));
    await refreshOnce("r1", run, () => NOW);
    await refreshOnce("r1", run, () => NOW);
    expect(run).toHaveBeenCalledTimes(2);
  });
});

describe("jwtExpiresAt", () => {
  it("exp claim'ni ms ga aylantiradi, buzuq token — 0", () => {
    expect(jwtExpiresAt(fakeJwt(NOW))).toBe(NOW);
    expect(jwtExpiresAt("garbage")).toBe(0);
    expect(jwtExpiresAt("a.@@@.c")).toBe(0);
  });
});
