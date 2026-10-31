import { describe, expect, it } from "vitest";
import { adminNavFor } from "./admin-nav";

const keys = (role: "editor" | "admin") => adminNavFor(role).map((item) => item.key);

describe("adminNavFor", () => {
  it("foydalanuvchilar bo'limi faqat admin'ga", () => {
    expect(keys("admin")).toEqual([
      "dashboard",
      "books",
      "library",
      "messages",
      "subjects",
      "stats",
      "users",
    ]);
    expect(keys("editor")).toEqual([
      "dashboard",
      "books",
      "library",
      "messages",
      "subjects",
      "stats",
    ]);
  });

  it("kitob sahifalari Kitoblar bo'limini faol qiladi", () => {
    const books = adminNavFor("editor").find((item) => item.key === "books")!;
    expect(books.isActive("/admin/kitoblar")).toBe(true);
    expect(books.isActive("/admin/kitoblar/abc")).toBe(true);
    expect(books.isActive("/admin/fanlar")).toBe(false);
    expect(books.isActive("/admin")).toBe(false);
  });
});
