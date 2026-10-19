import { describe, expect, it } from "vitest";
import { isSplashDismissKey, SPLASH_INIT_SCRIPT, SPLASH_STORAGE_KEY } from "./splash";

interface Env {
  pathname?: string;
  reducedMotion?: boolean;
  seen?: boolean;
  storageThrows?: boolean;
}

/** Inline skriptni soxta brauzer muhitida ishga tushirib, `<html data-splash>` qiymatini qaytaradi. */
function run({
  pathname = "/uz",
  reducedMotion = false,
  seen = false,
  storageThrows = false,
}: Env) {
  const dataset: Record<string, string> = {};
  const sessionStorage = {
    getItem(key: string) {
      if (storageThrows) throw new Error("SecurityError");
      return seen && key === SPLASH_STORAGE_KEY ? "1" : null;
    },
  };
  const matchMedia = () => ({ matches: reducedMotion });
  new Function("document", "location", "matchMedia", "sessionStorage", SPLASH_INIT_SCRIPT)(
    { documentElement: { dataset } },
    { pathname },
    matchMedia,
    sessionStorage,
  );
  return dataset.splash;
}

describe("splash: birinchi kirishda chiqadi", () => {
  it.each(["/uz", "/uz/", "/uz-Cyrl", "/ru", "/en/"])("%s bosh sahifasi", (pathname) => {
    expect(run({ pathname })).toBe("show");
  });
});

describe("splash: chiqmaydigan holatlar", () => {
  it("ikkinchi marta (sessiyada ko'rilgan) chiqmaydi", () => {
    expect(run({ seen: true })).toBe("skip");
  });

  it("reduced-motion yoqilgan bo'lsa chiqmaydi", () => {
    expect(run({ reducedMotion: true })).toBe("skip");
  });

  it("storage xato tashlasa umuman chiqmaydi", () => {
    expect(run({ storageThrows: true })).toBe("skip");
  });

  it.each([
    "/uz/darsliklar",
    "/uz/darsliklar/algebra-9/diskriminant",
    "/uz/kabinet",
    "/uz/ustoz",
    "/uz/kirish",
    "/uz/onboarding",
    "/uz/fanlar",
    "/xx",
  ])("%s da chiqmaydi", (pathname) => {
    expect(run({ pathname })).toBe("skip");
  });
});

describe("splash: yopish tugmalari", () => {
  it("Esc va Enter yopadi, boshqa tugmalar yopmaydi", () => {
    expect(isSplashDismissKey("Escape")).toBe(true);
    expect(isSplashDismissKey("Enter")).toBe(true);
    expect(isSplashDismissKey("a")).toBe(false);
    expect(isSplashDismissKey("Tab")).toBe(false);
  });
});
