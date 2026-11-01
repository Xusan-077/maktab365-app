import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import { PRIVATE_PATHS, ROBOTS_DISALLOW } from "./private-paths";

const APP = join(process.cwd(), "src/app/[locale]");
const source = (path: string) => readFileSync(join(APP, path), "utf8");

describe("robots.txt", () => {
  it("shaxsiy, o'qish va API yo'llarini yopadi, sitemap'ni ko'rsatadi", () => {
    const config = robots();
    const rule = Array.isArray(config.rules) ? config.rules[0] : config.rules;
    const disallow = [rule.disallow].flat();
    for (const path of [
      "/api/",
      "/*/admin",
      "/*/kabinet",
      "/*/ustoz",
      "/*/kirish",
      "/*/kutubxona/yozuvlarim",
      "/*/oqish",
    ]) {
      expect(disallow).toContain(path);
    }
    expect(disallow).toEqual(ROBOTS_DISALLOW);
    expect(String(config.sitemap)).toMatch(/\/sitemap\.xml$/);
    expect(PRIVATE_PATHS.length).toBeGreaterThan(5);
  });
});

describe("noindex sahifalar", () => {
  const NOINDEX_PAGES = [
    "(reader)/darsliklar/[sinf]/[slug]/oqish/page.tsx",
    "(reader)/darsliklar/[sinf]/[slug]/taqdimot/[mavzu]/page.tsx",
    "(reader)/kutubxona/[ref]/oqish/page.tsx",
    "(marketing)/kutubxona/yozuvlarim/page.tsx",
    "(login)/kirish/page.tsx",
    "(login)/kod/page.tsx",
    "(auth)/onboarding/page.tsx",
    "(auth)/email-tasdiqlash/page.tsx",
    "(auth)/parolni-tiklash/page.tsx",
    "(auth)/parolni-unutdim/page.tsx",
    "(app)/kabinet/page.tsx",
    "(app)/ustoz/page.tsx",
    "(app)/sozlamalar/page.tsx",
    "(play)/test/[id]/page.tsx",
    "(play)/games/[topicSlug]/[game]/page.tsx",
  ];

  it.each(NOINDEX_PAGES)("%s — robots: noindex", (path) => {
    expect(source(path)).toMatch(/NOINDEX|index:\s*false/);
  });

  it("admin layout hamma admin sahifalarini yopadi", () => {
    expect(source("(admin)/layout.tsx")).toMatch(/index:\s*false,\s*follow:\s*false/);
  });

  it("ommaviy sahifalar noindex emas", () => {
    for (const path of [
      "(marketing)/page.tsx",
      "(marketing)/darsliklar/page.tsx",
      "(marketing)/kutubxona/page.tsx",
      "(marketing)/kutubxona/[ref]/page.tsx",
    ]) {
      expect(source(path)).not.toMatch(/noindex|index:\s*false|NOINDEX/);
    }
  });
});
