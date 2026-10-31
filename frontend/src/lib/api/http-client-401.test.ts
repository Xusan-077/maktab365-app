import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.fn();
const signOut = vi.fn();
vi.mock("next-auth/react", () => ({ getSession, signOut }));

async function setup(responses: (call: number) => number) {
  vi.resetModules();
  getSession.mockReset().mockResolvedValue({ user: { id: "1" } });
  signOut.mockReset().mockResolvedValue(undefined);
  const { setApiSession } = await import("@/lib/api/session");
  setApiSession({ id: "1", name: "Ali" });
  const assigned: string[] = [];
  vi.stubGlobal("window", {
    location: {
      origin: "http://localhost",
      pathname: "/uz/kabinet",
      search: "?x=1",
      set href(value: string) {
        assigned.push(value);
      },
    },
  });
  let call = 0;
  const baseFetch = vi.fn(async () => {
    call += 1;
    const status = responses(call);
    return new Response(status === 200 ? "{}" : null, { status });
  });
  const { createFetch } = await import("./http-client");
  return { run: createFetch({ fetch: baseFetch as unknown as typeof fetch }), baseFetch, assigned };
}

describe("brauzerda 401", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("parallel 401: bitta sessiya yangilash, hammasi qayta uriniladi, chiqish yo'q", async () => {
    // Birinchi 3 so'rov 401, qayta urinishlar 200.
    const { run, baseFetch } = await setup((call) => (call <= 3 ? 401 : 200));
    const results = await Promise.all(
      [1, 2, 3].map(() => run("http://localhost/api/backend/api/v1/me/")),
    );
    expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(getSession).toHaveBeenCalledTimes(1);
    expect(signOut).not.toHaveBeenCalled();
    expect(baseFetch).toHaveBeenCalledTimes(6);
  });

  it("qayta urinish ham 401: cookie tozalanadi va kirishga bir marta yo'naltiriladi", async () => {
    const { run, assigned } = await setup(() => 401);
    await Promise.all([1, 2, 3].map(() => run("http://localhost/api/backend/api/v1/me/")));
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledWith({ redirect: false });
    expect(assigned).toEqual([`/uz/kirish?callbackUrl=${encodeURIComponent("/uz/kabinet?x=1")}`]);
  });

  it("mehmon: 401 tegilmaydi", async () => {
    const { run, assigned } = await setup(() => 401);
    const { setApiSession } = await import("@/lib/api/session");
    setApiSession(null);
    const response = await run("http://localhost/api/backend/api/v1/me/");
    expect(response.status).toBe(401);
    expect(getSession).not.toHaveBeenCalled();
    expect(assigned).toEqual([]);
  });
});
