import { describe, expect, it } from "vitest";
import { isAdminDenied, isAdminPath } from "./staff";
import { staffRoleOf } from "./tokens";

describe("staff", () => {
  it("staffRoleOf faqat editor va admin ni taniydi", () => {
    expect(staffRoleOf("editor")).toBe("editor");
    expect(staffRoleOf("admin")).toBe("admin");
    for (const role of ["student", "teacher", "", null, undefined, "Admin"]) {
      expect(staffRoleOf(role)).toBeNull();
    }
  });

  it("isAdminPath faqat /admin va ichkilarini topadi", () => {
    expect(isAdminPath("/admin")).toBe(true);
    expect(isAdminPath("/admin/kitoblar/1")).toBe(true);
    expect(isAdminPath("/administrator")).toBe(false);
    expect(isAdminPath("/kabinet")).toBe(false);
  });

  it("isAdminDenied: aniq staff=null yopiladi, editor/admin va eski sessiya o'tadi", () => {
    expect(isAdminDenied("/admin/kitoblar", null)).toBe(true);
    expect(isAdminDenied("/admin", "editor")).toBe(false);
    expect(isAdminDenied("/admin", "admin")).toBe(false);
    expect(isAdminDenied("/admin", undefined)).toBe(false);
    expect(isAdminDenied("/kabinet", null)).toBe(false);
  });
});
