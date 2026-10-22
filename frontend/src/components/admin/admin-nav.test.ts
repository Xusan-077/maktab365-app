import { describe, expect, it } from "vitest";
import { adminNavFor } from "./admin-nav";

const keys = (role: "editor" | "admin") => adminNavFor(role).map((item) => item.key);

describe("adminNavFor", () => {
  it("foydalanuvchilar bo'limi faqat admin'ga", () => {
    expect(keys("admin")).toEqual(["dashboard", "books", "pdfBooks", "subjects", "users"]);
    expect(keys("editor")).toEqual(["dashboard", "books", "pdfBooks", "subjects"]);
  });

  it("mavzu sahifalari Kitoblar bo'limini faol qiladi", () => {
    const books = adminNavFor("editor").find((item) => item.key === "books")!;
    expect(books.isActive("/admin/kitoblar/abc")).toBe(true);
    expect(books.isActive("/admin/mavzular/xyz")).toBe(true);
    expect(books.isActive("/admin")).toBe(false);
  });
});
