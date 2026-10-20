import { describe, expect, it } from "vitest";
import { clientInfoFrom, forwardHeaders } from "./backend";

const headers = (init: Record<string, string>) => new Headers(init);

describe("clientInfoFrom", () => {
  it("X-Forwarded-For dan o'ngdagi (ishonchli proxy qo'shgan) yozuvni oladi", () => {
    const h = headers({ "x-forwarded-for": "6.6.6.6, 203.0.113.5", "user-agent": "UA" });
    expect(clientInfoFrom(h, 1)).toEqual({ ip: "203.0.113.5", userAgent: "UA" });
    expect(clientInfoFrom(h, 2).ip).toBe("6.6.6.6");
  });

  it("zanjir qisqa yoki yo'q bo'lsa x-real-ip", () => {
    expect(clientInfoFrom(headers({ "x-real-ip": "198.51.100.1" }), 1).ip).toBe("198.51.100.1");
    expect(clientInfoFrom(headers({ "x-forwarded-for": "1.1.1.1" }), 2).ip).toBeUndefined();
  });
});

describe("forwardHeaders", () => {
  it("IP faqat umumiy sir bilan uzatiladi", () => {
    const info = { ip: "203.0.113.5", userAgent: "UA" };
    expect(forwardHeaders(info, "s3")).toEqual({
      "X-Forwarded-For": "203.0.113.5",
      "X-Forwarded-Secret": "s3",
      "User-Agent": "UA",
    });
    expect(forwardHeaders(info, undefined)).toEqual({ "User-Agent": "UA" });
    expect(forwardHeaders(info, "")).toEqual({ "User-Agent": "UA" });
  });
});
