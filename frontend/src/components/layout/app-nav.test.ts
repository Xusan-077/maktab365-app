import { describe, expect, it } from "vitest";
import { appNavFor } from "./app-nav";

describe("appNavFor", () => {
  it("o'quvchi: Bosh sahifa, Darsliklar, Fanlarim, Natijalar, Saqlanganlar; ustoz: Bosh sahifa, Darsliklar, Mening testlarim, Saqlanganlar", () => {
    expect(appNavFor("kabinet").map((item) => item.href)).toEqual([
      "/kabinet",
      "/darsliklar",
      "/kabinet/fanlar",
      "/kabinet/natijalar",
      "/kabinet/saqlanganlar",
    ]);
    expect(appNavFor("ustoz").map((item) => item.href)).toEqual([
      "/ustoz",
      "/darsliklar",
      "/ustoz/testlar",
      "/ustoz/saqlanganlar",
    ]);
  });

  it("'Darsliklar' ochiq katalogga olib boradi va panelda hech qachon faol emas", () => {
    for (const base of ["kabinet", "ustoz"] as const) {
      const textbooks = appNavFor(base)[1]!;
      expect(textbooks.isActive("/darsliklar")).toBe(false);
    }
  });

  it("Bosh sahifa faqat o'z yo'lida, Saqlanganlar ichki yo'llarda faol", () => {
    const [home, , , , saved] = appNavFor("kabinet");
    expect(home!.isActive("/kabinet")).toBe(true);
    expect(home!.isActive("/kabinet/saqlanganlar")).toBe(false);
    expect(saved!.isActive("/kabinet/saqlanganlar")).toBe(true);
  });
});
