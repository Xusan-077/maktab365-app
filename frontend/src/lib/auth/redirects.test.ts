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

  it("admin: ochiq saytni oddiy foydalanuvchidek ko'radi (yo'naltirilmaydi)", () => {
    const admin: RedirectSession = { user: { role: "teacher", staff: "admin", onboarded: true } };
    for (const path of [
      "/",
      "/darsliklar",
      "/darsliklar/9/9-sinf-algebra",
      "/darsliklar/9/9-sinf-algebra/oqish",
      "/fanlar",
      "/yordam",
      "/admin",
      "/admin/kitoblar",
      "/admin/xabarlar",
    ]) {
      expect(go(path, admin), path).toBeNull();
    }
  });

  it("admin: o'quvchi/ustoz panellari, kirish va onboarding → /admin (onboarding'siz)", () => {
    const admin: RedirectSession = { user: { role: "teacher", staff: "admin", onboarded: true } };
    for (const path of [
      "/kabinet",
      "/kabinet/fanlar",
      "/ustoz",
      "/sozlamalar",
      "/kirish",
      "/onboarding",
    ]) {
      expect(go(path, admin), path).toBe("/admin");
    }
    // `onboarded` false bo'lsa ham onboarding'ga yuborilmaydi; ochiq sayt ochiq.
    const fresh: RedirectSession = { user: { role: "teacher", staff: "admin", onboarded: false } };
    expect(go("/admin", fresh)).toBeNull();
    expect(go("/darsliklar", fresh)).toBeNull();
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
