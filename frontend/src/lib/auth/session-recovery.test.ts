import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
vi.mock("next-auth/react", () => ({ getSession }));

describe("recoverSession", () => {
  beforeEach(() => {
    vi.resetModules();
    getSession.mockReset();
  });

  it("bir vaqtdagi ko'p so'rov uchun bitta getSession chaqiradi", async () => {
    getSession.mockResolvedValue({ user: { id: "1" } });
    const { recoverSession } = await import("./session-recovery");
    const results = await Promise.all([recoverSession(), recoverSession(), recoverSession()]);
    expect(results).toEqual([true, true, true]);
    expect(getSession).toHaveBeenCalledTimes(1);
  });

  it("sessiya tugagan bo'lsa false qaytaradi", async () => {
    getSession.mockResolvedValue(null);
    const { recoverSession } = await import("./session-recovery");
    expect(await recoverSession()).toBe(false);
  });
});
