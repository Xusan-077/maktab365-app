/* maktab365 Service Worker: oflayn qobiq va ochiq kontent keshi.
 *
 * - /_next/static/*, ikonkalar: cache-first (fayl nomida xesh bor).
 * - Sahifa navigatsiyasi: network-first (4 s), muvaffaqiyatli javob keshlanadi; internet yo'q bo'lsa
 *   avval ko'rilgan sahifa, aks holda /offline.html.
 * - Ochiq kitob ma'lumoti (`/api/backend/api/v1/pdf-books/…` GET): stale-while-revalidate;
 *   imzolangan URL, yuklab olish, qidiruv va statistika keshlanmaydi.
 * - PDF fayllar bu yerda KESHLANMAYDI: "Oflayn saqlash" ularni sahifaning o'zi `maktab365-pdf-v1`
 *   keshiga yozadi (shu nomli kesh yangilanishda o'chirilmaydi).
 */
const VERSION = "v2";
const STATIC_CACHE = `m365-static-${VERSION}`;
const PAGE_CACHE = `m365-pages-${VERSION}`;
const DATA_CACHE = `m365-data-${VERSION}`;
const KEEP = new Set([STATIC_CACHE, PAGE_CACHE, DATA_CACHE, "maktab365-pdf-v1"]);
const NAVIGATION_TIMEOUT_MS = 4000;
const PAGE_LIMIT = 40;

const NEVER_CACHE = ["/file-url/", "/download/", "/search/", "/stats/", "/slides/"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PAGE_CACHE)
      .then((cache) => cache.add(new Request("/offline.html", { cache: "reload" })))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(names.filter((name) => !KEEP.has(name)).map((name) => caches.delete(name))),
      )
      .then(() => self.clients.claim()),
  );
});

async function trim(cacheName, limit) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  for (const key of keys.slice(0, Math.max(0, keys.length - limit))) {
    if (new URL(key.url).pathname !== "/offline.html") await cache.delete(key);
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function networkFirstPage(request) {
  const cache = await caches.open(PAGE_CACHE);
  try {
    const response = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), NAVIGATION_TIMEOUT_MS)),
    ]);
    if (response.ok && response.type === "basic") {
      cache.put(request, response.clone());
      trim(PAGE_CACHE, PAGE_LIMIT);
    }
    return response;
  } catch {
    return (await cache.match(request)) || (await cache.match("/offline.html")) || Response.error();
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(DATA_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);
  return cached || (await network) || Response.error();
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/") || /^\/(icon|apple-icon|logo)/.test(url.pathname)) {
    event.respondWith(cacheFirst(request));
  } else if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
  } else if (
    url.pathname.startsWith("/api/backend/api/v1/pdf-books/") &&
    !NEVER_CACHE.some((part) => url.pathname.includes(part))
  ) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
