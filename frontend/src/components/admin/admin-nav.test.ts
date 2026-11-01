import { describe, expect, it } from "vitest";
import { adminNavFor } from "./admin-nav";

const keys = (role: "editor" | "admin") => adminNavFor(role).map((item) => item.key);

describe("adminNavFor", () => {
  it("foydalanuvchilar bo'limi faqat admin'ga", () => {
    expect(keys("admin")).toEqual([
      "dashboard",
      "library",
      "messages",
      "subjects",
      "stats",
      "users",
    ]);
    expect(keys("editor")).toEqual(["dashboard", "library", "messages", "subjects", "stats"]);
  });

  it("darslik va kitob sahifalari yagona Kutubxona bo'limini faol qiladi", () => {
    const books = adminNavFor("editor").find((item) => item.key === "library")!;
    expect(books.isActive("/admin/kitoblar")).toBe(true);
    expect(books.isActive("/admin/kitoblar/abc")).toBe(true);
    expect(books.isActive("/admin/kutubxona/turlar")).toBe(true);
    expect(books.isActive("/admin/fanlar")).toBe(false);
    expect(books.isActive("/admin")).toBe(false);
  });
});
