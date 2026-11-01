/**
 * Qidiruv indeksiga kirmaydigan yo'llar (tilsiz, `/*` — har qanday til prefiksi bilan).
 * `robots.ts` shu ro'yxatdan disallow yozadi; har bir sahifa baribir o'zi `noindex,nofollow` beradi
 * (robots.txt faqat yurishni to'xtatadi, indeksdan chiqarishni meta teg kafolatlaydi).
 */
export const PRIVATE_PATHS = [
  "/admin",
  "/kabinet",
  "/ustoz",
  "/sozlamalar",
  "/kirish",
  "/kod",
  "/royxatdan-otish",
  "/onboarding",
  "/email-tasdiqlash",
  "/parolni-tiklash",
  "/parolni-unutdim",
  "/kutubxona/yozuvlarim",
  "/oflayn",
  "/test/",
] as const;

/** O'qish oynalari: `/darsliklar/N/<slug>/oqish`, `/kutubxona/<slug>/oqish`, taqdimot, o'yin natijasi. */
export const PRIVATE_PATTERNS = ["/*/oqish", "/*/taqdimot/", "/*/natija"] as const;

export const ROBOTS_DISALLOW = [
  "/api/",
  ...PRIVATE_PATHS.map((path) => `/*${path}`),
  ...PRIVATE_PATTERNS,
];
