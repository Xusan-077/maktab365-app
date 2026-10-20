import { describe, expect, it } from "vitest";
import { resolveAuthRedirect, type RedirectSession } from "./redirects";

const student = (onboarded = true): RedirectSession => ({ user: { role: "student", onboarded } });
const teacher: RedirectSession = { user: { role: "teacher", onboarded: true } };
const google: RedirectSession = { user: {} };

const go = (path: string, session: RedirectSession | null, roleHint?: string) =>
  resolveAuthRedirect({ path, returnTo: `/uz${path}`, session, roleHint });

describe("resolveAuthRedirect", () => {
  it("kirmagan: himoyalangan sahifa va onboarding → kirish (callbackUrl bilan)", () => {
    expect(go("/kabinet/fanlar", null)).toBe("/kirish?callbackUrl=%2Fuz%2Fkabinet%2Ffanlar");
    expect(go("/ustoz", null)).toBe("/kirish?callbackUrl=%2Fuz%2Fustoz");
    expect(go("/sozlamalar", null)).toMatch(/^\/kirish\?/);
    expect(go("/onboarding", null)).toMatch(/^\/kirish\?/);
  });

  it("kirmagan: ochiq sahifalarga tegmaydi", () => {
    for (const path of ["/", "/darsliklar", "/kirish", "/parolni-unutdim", "/kabinetlar"]) {
      expect(go(path, null)).toBeNull();
    }
  });

  it("onboarding tugamagan → /onboarding (panel, sozlamalar, kirish sahifasidan)", () => {
    expect(go("/kabinet", student(false))).toBe("/onboarding");
    expect(go("/ustoz/mavzular", student(false))).toBe("/onboarding");
    expect(go("/sozlamalar", student(false))).toBe("/onboarding");
    expect(go("/kirish", student(false))).toBe("/onboarding");
    expect(go("/onboarding", student(false))).toBeNull();
    expect(go("/darsliklar", student(false))).toBeNull();
  });

  it("onboarding tugagan: onboarding va kirishdan rol paneliga", () => {
    expect(go("/onboarding", student())).toBe("/kabinet");
    expect(go("/kirish", teacher)).toBe("/ustoz");
  });

  it("rolga qarab: o'quvchi /ustoz dan /kabinet ga, o'qituvchi aksincha", () => {
    expect(go("/ustoz/mavzular", student())).toBe("/kabinet");
    expect(go("/kabinet/fanlar", teacher)).toBe("/ustoz");
    expect(go("/kabinet/fanlar", student())).toBeNull();
    expect(go("/ustoz", teacher)).toBeNull();
    expect(go("/sozlamalar", teacher)).toBeNull();
  });

  it("sessiya maydonlari rol cookie'sidan ustun", () => {
    expect(go("/kabinet", teacher, "student")).toBe("/ustoz");
  });

  it("Google (eski oqim): faqat rol cookie'si bo'yicha", () => {
    expect(go("/kabinet", google, "teacher")).toBe("/ustoz");
    expect(go("/kabinet", google)).toBeNull();
    expect(go("/kirish", google, "teacher")).toBeNull();
    expect(go("/kabinet", google, "hacker")).toBeNull();
  });
});
