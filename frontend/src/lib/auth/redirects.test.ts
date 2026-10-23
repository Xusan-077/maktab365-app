import { describe, expect, it } from "vitest";
import { resolveAuthRedirect, type RedirectSession } from "./redirects";

const student = (onboarded = true): RedirectSession => ({ user: { role: "student", onboarded } });
const teacher: RedirectSession = { user: { role: "teacher", onboarded: true } };
const go = (path: string, session: RedirectSession | null) =>
  resolveAuthRedirect({ path, returnTo: `/uz${path}`, session });

describe("resolveAuthRedirect", () => {
  it("kirmagan: himoyalangan sahifa va onboarding → kirish (callbackUrl bilan)", () => {
    expect(go("/kabinet/fanlar", null)).toBe("/kirish?callbackUrl=%2Fuz%2Fkabinet%2Ffanlar");
    expect(go("/ustoz", null)).toBe("/kirish?callbackUrl=%2Fuz%2Fustoz");
    expect(go("/sozlamalar", null)).toMatch(/^\/kirish\?/);
    expect(go("/onboarding", null)).toMatch(/^\/kirish\?/);
  });

  it("kirmagan: ochiq sahifalarga tegmaydi", () => {
    for (const path of [
      "/",
      "/darsliklar",
      "/kirish",
      "/royxatdan-otish",
      "/kod",
      "/parolni-unutdim",
      "/kabinetlar",
    ]) {
      expect(go(path, null)).toBeNull();
    }
  });

  it("onboarding tugamagan → /onboarding (panel, sozlamalar, kirish sahifasidan)", () => {
    expect(go("/kabinet", student(false))).toBe("/onboarding");
    expect(go("/ustoz/mavzular", student(false))).toBe("/onboarding");
    expect(go("/sozlamalar", student(false))).toBe("/onboarding");
    expect(go("/kirish", student(false))).toBe("/onboarding");
    expect(go("/royxatdan-otish", student(false))).toBe("/onboarding");
    expect(go("/kod", student(false))).toBe("/onboarding");
    expect(go("/onboarding", student(false))).toBeNull();
    expect(go("/darsliklar", student(false))).toBeNull();
  });

  it("onboarding tugagan: onboarding va kirishdan rol paneliga", () => {
    expect(go("/onboarding", student())).toBe("/kabinet");
    expect(go("/kirish", teacher)).toBe("/ustoz");
    expect(go("/royxatdan-otish", teacher)).toBe("/ustoz");
    expect(go("/kod", student())).toBe("/kabinet");
  });

  it("rolga qarab: o'quvchi /ustoz dan /kabinet ga, o'qituvchi aksincha", () => {
    expect(go("/ustoz/mavzular", student())).toBe("/kabinet");
    expect(go("/kabinet/fanlar", teacher)).toBe("/ustoz");
    expect(go("/kabinet/fanlar", student())).toBeNull();
    expect(go("/ustoz", teacher)).toBeNull();
    expect(go("/sozlamalar", teacher)).toBeNull();
  });

  it("rol/onboarding maydonlari yo'q sessiya: yo'naltirilmaydi", () => {
    expect(go("/kabinet", { user: {} })).toBeNull();
  });

  it("admin: faqat /admin — sayt, kabinet, ustoz va kirish sahifalaridan /admin ga qaytadi", () => {
    const admin: RedirectSession = { user: { role: "teacher", staff: "admin", onboarded: true } };
    for (const path of [
      "/",
      "/darsliklar",
      "/darsliklar/abc",
      "/kabinet",
      "/kabinet/fanlar",
      "/ustoz",
      "/sozlamalar",
      "/kirish",
      "/onboarding",
      "/yordam",
    ]) {
      expect(go(path, admin)).toBe("/admin");
    }
    for (const path of ["/admin", "/admin/kitoblar", "/admin/foydalanuvchilar"]) {
      expect(go(path, admin)).toBeNull();
    }
    // Admin onboarding'dan o'tmaydi (hatto `onboarded` false bo'lsa ham)
    const fresh: RedirectSession = { user: { role: "teacher", staff: "admin", onboarded: false } };
    expect(go("/admin", fresh)).toBeNull();
    expect(go("/kabinet", fresh)).toBe("/admin");
  });

  it("editor admin emas: sayt va panellarga kirishda cheklanmaydi", () => {
    const editor: RedirectSession = { user: { role: "teacher", staff: "editor", onboarded: true } };
    expect(go("/darsliklar", editor)).toBeNull();
    expect(go("/ustoz", editor)).toBeNull();
  });

  it("/admin: kirmagan → kirish; editor/admin o'z joyida, panel redirect'i tegmaydi", () => {
    expect(go("/admin/kitoblar", null)).toBe("/kirish?callbackUrl=%2Fuz%2Fadmin%2Fkitoblar");
    const editor: RedirectSession = { user: { role: "teacher", staff: "editor", onboarded: true } };
    expect(go("/admin", editor)).toBeNull();
    expect(go("/admin/kitoblar", student())).toBeNull(); // rolni proxy emas, StaffGate hal qiladi
    expect(go("/admin", student(false))).toBe("/onboarding");
  });
});
