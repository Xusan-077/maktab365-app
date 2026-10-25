// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import uz from "@/lib/i18n/messages/uz.json";

const nav = vi.hoisted(() => ({
  params: new URLSearchParams(),
  replace: vi.fn(),
}));
const progress = vi.hoisted(() => ({
  state: { ready: true, position: null as null | { page: number }, resume: 1, record: vi.fn() },
}));
const api = vi.hoisted(() => ({ book: vi.fn() }));
/** pdf.js hujjati: vertikal rejim bet o'lchamini `getPage().getViewport()` dan oladi. */
const pdfDoc = vi.hoisted(() => ({
  numPages: 240,
  getPage: async () => ({ getViewport: () => ({ width: 600, height: 800 }) }),
}));

vi.mock("next/navigation", () => ({ useSearchParams: () => nav.params }));
vi.mock("@/lib/i18n/navigation", () => ({
  usePathname: () => "/darsliklar/book-1",
  useRouter: () => ({ replace: nav.replace }),
  Link: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("@/hooks/usePdfProgress", () => ({ usePdfProgress: () => progress.state }));
vi.mock("@/hooks/useBookStats", () => ({ useBookStats: vi.fn() }));
vi.mock("@/hooks/usePdfAnnotations", () => ({
  usePdfAnnotations: () => ({ items: [], save: vi.fn(), remove: vi.fn(), failed: false }),
}));
vi.mock("@/lib/pdf-books/api", () => ({
  getPdfBooksApi: () => api,
  PDF_PAGE_SIZE: 24,
}));
vi.mock("./PdfBookmarkButton", () => ({ PdfBookmarkButton: () => null }));
vi.mock("@/components/support/ReportErrorLink", () => ({ ReportErrorLink: () => null }));
vi.mock("./usePdfDocument", () => ({
  usePdfDocument: () => ({ doc: pdfDoc, loading: false, error: null, reload: vi.fn() }),
  useSlidesDocument: () => ({ doc: { numPages: 8 }, loading: false, error: null, reload: vi.fn() }),
}));
vi.mock("./PdfPageCanvas", () => ({
  PdfPageCanvas: ({ pageNumber, current }: { pageNumber: number; current?: boolean }) => (
    <div data-testid="pdf-canvas" data-page={pageNumber} data-current={current || undefined} />
  ),
}));

import { PdfReader } from "./PdfReader";

function setup(query = "", extra: Record<string, unknown> = {}) {
  nav.params = new URLSearchParams(query);
  api.book.mockResolvedValue({
    ...extra,
    id: "book-1",
    title: { uz: "Algebra 9" },
    page_count: 240,
    grade: 9,
    subject: "algebra",
    subject_title: { uz: "Algebra" },
    subject_group: "exact",
    slug: "9-sinf-algebra",
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <NextIntlClientProvider locale="uz" messages={uz}>
      <QueryClientProvider client={client}>
        <PdfReader bookId="book-1" />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

const CURRENT = '[data-testid="pdf-canvas"][data-current]';
const currentCanvas = () => document.querySelector<HTMLElement>(CURRENT);
/** Joriy (URL'dagi) bet: gorizontalda qo'shni betlar ham (ko'rinmas) chiziladi. */
const currentPage = async () => {
  await waitFor(() => expect(currentCanvas()).not.toBeNull());
  return currentCanvas()?.dataset.page;
};
const renderedPages = () =>
  screen.queryAllByTestId("pdf-canvas").map((node) => Number(node.dataset.page));

const PREFS_KEY = "maktab365-reader-prefs";
const storeMode = (mode: "b" | "h" | "v" | null, extra: Record<string, unknown> = {}) =>
  window.localStorage.setItem(
    PREFS_KEY,
    JSON.stringify({ state: { tone: "light", mode, ...extra } }),
  );
const status = uz.pdfBooks.toc.status;

/** `matchMedia`: `true` — desktop (≥1024, ochiq kitob — 2 bet), `false` — mobil. */
const setViewport = (wide: boolean) => {
  window.matchMedia = ((query: string) => ({
    matches: wide,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
};

beforeEach(() => {
  vi.clearAllMocks();
  // Mundarija paneli (useMediaQuery) uchun: jsdom'da matchMedia yo'q; <dialog> usullari ham.
  setViewport(false);
  // Mavjud testlar bitta betli kitob rejimida (mobil + saqlangan "b").
  storeMode("b");
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close")); // jsdom bermaydi; brauzerda Esc/close() shuni chiqaradi
  };
  progress.state = { ready: true, position: null, resume: 1, record: vi.fn() };
  // O'qish oynasi URL'ni `history.replaceState("?…")` bilan yangilaydi (Next router bilan sinxron):
  // testlarda router mock'idek — `nav.replace(<yo'l>?…)`, haqiqiy URL o'zgarmaydi.
  vi.spyOn(window.history, "replaceState").mockImplementation((_state, _unused, url) => {
    nav.replace(`/darsliklar/book-1${String(url)}`, { scroll: false });
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("PdfReader", () => {
  it("?page=12 bo'yicha shu sahifani chizadi va «12 / 240» ni ko'rsatadi", async () => {
    setup("page=12");
    expect(await currentPage()).toBe("12");
    expect((screen.getByTestId("pdf-page-input") as HTMLInputElement).value).toBe("12");
    expect(screen.getByTestId("pdf-page-total").textContent).toBe("/ 240");
    expect(nav.replace).not.toHaveBeenCalled(); // URL allaqachon to'g'ri
  });

  it("chegaradan tashqari ?page= ni tuzatadi va URL'ni yangilaydi", async () => {
    setup("page=999");
    expect(await currentPage()).toBe("240");
    await waitFor(() =>
      expect(nav.replace).toHaveBeenCalledWith("/darsliklar/book-1?page=240", { scroll: false }),
    );
  });

  it("?page= bo'lmasa saqlangan sahifadan davom etadi va URL'ga yozadi", async () => {
    progress.state = { ready: true, position: { page: 37 }, resume: 37, record: vi.fn() };
    setup();
    expect(await currentPage()).toBe("37");
    await waitFor(() =>
      expect(nav.replace).toHaveBeenCalledWith("/darsliklar/book-1?page=37", { scroll: false }),
    );
  });

  it("pozitsiya hali aniqlanmagan bo'lsa sahifa chizilmaydi", async () => {
    progress.state = { ready: false, position: null, resume: 1, record: vi.fn() };
    setup();
    await screen.findByTestId("pdf-reader");
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(screen.queryAllByTestId("pdf-canvas")).toHaveLength(0);
  });

  it("← / → klavishlari sahifani suradi (URL kechiksa ham bosishlar to'planadi)", async () => {
    setup("page=5");
    await currentPage();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(nav.replace).toHaveBeenNthCalledWith(1, "/darsliklar/book-1?page=6", {
      scroll: false,
    });
    // URL (mock) yangilanmagan, lekin ← so'ralgan 6-betdan hisoblanadi.
    expect(nav.replace).toHaveBeenNthCalledWith(2, "/darsliklar/book-1?page=5", {
      scroll: false,
    });
  });

  it("matn maydonida yozayotganda strelka klavishlari sahifani o'zgartirmaydi", async () => {
    setup("page=5");
    await currentPage();
    fireEvent.keyDown(screen.getByTestId("pdf-page-input"), { key: "ArrowRight" });
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("birinchi sahifada ←, oxirgisida → hech narsa qilmaydi", async () => {
    setup("page=1");
    await currentPage();
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(nav.replace).not.toHaveBeenCalled();
    cleanup();
    setup("page=240");
    await currentPage();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("mobilda chapga swipe — keyingi sahifa, o'ngga — oldingi", async () => {
    setup("page=5");
    await currentPage();
    const area = screen.getByTestId("pdf-page-area");
    const swipe = (fromX: number, toX: number) => {
      fireEvent.pointerDown(area, { pointerType: "touch", clientX: fromX, clientY: 100 });
      fireEvent.pointerUp(area, { pointerType: "touch", clientX: toX, clientY: 105 });
    };
    swipe(300, 100);
    swipe(100, 300);
    expect(nav.replace).toHaveBeenNthCalledWith(1, "/darsliklar/book-1?page=6", {
      scroll: false,
    });
    // URL (mock) yangilanmagan, lekin ← so'ralgan 6-betdan hisoblanadi.
    expect(nav.replace).toHaveBeenNthCalledWith(2, "/darsliklar/book-1?page=5", {
      scroll: false,
    });
  });

  it("sichqoncha harakati swipe hisoblanmaydi", async () => {
    setup("page=5");
    await currentPage();
    const area = screen.getByTestId("pdf-page-area");
    fireEvent.pointerDown(area, { pointerType: "mouse", clientX: 300, clientY: 100 });
    fireEvent.pointerUp(area, { pointerType: "mouse", clientX: 100, clientY: 100 });
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("joriy sahifani eslab qolish uchun progress'ga yozadi", async () => {
    setup("page=9");
    await currentPage();
    await waitFor(() => expect(progress.state.record).toHaveBeenCalledWith(9));
  });

  it("topilmagan kitob uchun xabar ko'rsatadi", async () => {
    const { ApiError } = await import("@/lib/api/types");
    nav.params = new URLSearchParams();
    api.book.mockRejectedValue(new ApiError("x", 404, { code: "not_found" }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <NextIntlClientProvider locale="uz" messages={uz}>
        <QueryClientProvider client={client}>
          <PdfReader bookId="book-1" />
        </QueryClientProvider>
      </NextIntlClientProvider>,
    );
    expect(await screen.findByText(uz.pdfBooks.reader.notFound)).toBeTruthy();
  });
});

const CHAPTERS = [
  {
    id: "c1",
    title: "Kirish",
    page: 1,
    children: [{ id: "c1a", title: "Maqsad", page: 10 }],
  },
  { id: "c2", title: "Algebra", page: 50 },
];

describe("PdfReader: mundarija", () => {
  it("mundarija bo'lmasa panelda «Mundarija» yorlig'i yo'q", async () => {
    setup("page=5", { description: "", chapters: [] });
    await currentPage();
    fireEvent.click(await screen.findByTestId("pdf-toc-open"));
    expect(screen.queryByTestId("reader-tab-toc")).toBeNull();
    expect(screen.queryByTestId("pdf-toc")).toBeNull();
  });

  it("tugma panelni ochadi; bo'limni bossa shu betga o'tadi va panel yopiladi", async () => {
    setup("page=5", { description: "", chapters: CHAPTERS });
    await currentPage();
    fireEvent.click(await screen.findByTestId("pdf-toc-open"));

    const items = await screen.findAllByTestId("pdf-toc-item");
    expect(items.map((item) => item.textContent)).toEqual([
      `${status.current}Kirish1-bet`,
      `${status.unread}Maqsad10-bet`,
      `${status.unread}Algebra50-bet`,
    ]);
    fireEvent.click(items[2]);
    expect(nav.replace).toHaveBeenCalledWith("/darsliklar/book-1?page=50", { scroll: false });
    await waitFor(() => expect(screen.queryByTestId("pdf-toc-drawer")).toBeNull());
  });

  it("joriy bo'lim ajratib ko'rsatiladi", async () => {
    setup("page=12", { description: "", chapters: CHAPTERS });
    await currentPage();
    fireEvent.click(await screen.findByTestId("pdf-toc-open"));
    const items = await screen.findAllByTestId("pdf-toc-item");
    expect(items.map((item) => item.getAttribute("aria-current"))).toEqual([
      null,
      "location",
      null,
    ]);
  });

  it("bo'lim beti PDF dan katta bo'lsa oxirgi betga tuzatiladi", async () => {
    setup("page=5", { description: "", chapters: [{ id: "x", title: "Oxiri", page: 999 }] });
    await currentPage();
    fireEvent.click(await screen.findByTestId("pdf-toc-open"));
    fireEvent.click((await screen.findAllByTestId("pdf-toc-item"))[0]);
    expect(nav.replace).toHaveBeenCalledWith("/darsliklar/book-1?page=240", { scroll: false });
  });
});

const SLIDES_ID = "3f2b8c1e-5d4a-4c7e-9a10-0b6f1d2e3c4d";
const NO_SLIDES_ID = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
const SLIDES_CHAPTERS = [
  {
    id: SLIDES_ID,
    title: "Kirish",
    page: 12,
    slides: { page_count: 8, size_bytes: 2048 },
    children: [],
  },
  { id: NO_SLIDES_ID, title: "Algebra", page: 50, slides: null, children: [] },
];

describe("PdfReader: prezentatsiya", () => {
  beforeEach(() => window.localStorage.clear());

  it("?slides=<id>&slide=3 bo'yicha ko'rgich shu slaydda ochiladi, kitob sahifasi saqlanadi", async () => {
    setup(`page=5&slides=${SLIDES_ID}&slide=3`, { description: "", chapters: SLIDES_CHAPTERS });

    const viewer = await screen.findByTestId("slides-viewer");

    expect(viewer.hasAttribute("open")).toBe(true);
    expect(within(viewer).getByTestId("pdf-canvas").dataset.page).toBe("3");
    expect(within(viewer).getByTestId("slides-position").textContent).toContain("3 / 8");
    expect(nav.replace).not.toHaveBeenCalled(); // URL allaqachon to'g'ri
  });

  it("slayd ko'rsatilmagan havola oxirgi ko'rilgan slaydga (yoki 1 ga) to'ldiriladi", async () => {
    window.localStorage.setItem(`maktab365-slides:${SLIDES_ID}`, "6");
    setup(`page=5&slides=${SLIDES_ID}`, { description: "", chapters: SLIDES_CHAPTERS });

    await waitFor(() =>
      expect(nav.replace).toHaveBeenCalledWith(
        `/darsliklar/book-1?page=5&slides=${SLIDES_ID}&slide=6`,
        { scroll: false },
      ),
    );
  });

  it("slayd almashganda URL yangilanadi, ?page= va ?slides= saqlanadi", async () => {
    setup(`page=5&slides=${SLIDES_ID}&slide=3`, { description: "", chapters: SLIDES_CHAPTERS });
    const viewer = await screen.findByTestId("slides-viewer");

    fireEvent.click(within(viewer).getByTestId("slides-next"));

    expect(nav.replace).toHaveBeenCalledWith(
      `/darsliklar/book-1?page=5&slides=${SLIDES_ID}&slide=4`,
      { scroll: false },
    );
  });

  it("«Kitobga qaytish» ko'rgichni yopadi va shu bo'limning kitobdagi betiga o'tadi", async () => {
    setup(`page=5&slides=${SLIDES_ID}&slide=3`, { description: "", chapters: SLIDES_CHAPTERS });
    const viewer = await screen.findByTestId("slides-viewer");

    fireEvent.click(within(viewer).getByTestId("slides-back"));

    expect(nav.replace).toHaveBeenCalledWith("/darsliklar/book-1?page=12", { scroll: false });
  });

  it("«Yopish» kitobdagi joriy sahifada qoladi", async () => {
    setup(`page=5&slides=${SLIDES_ID}&slide=3`, { description: "", chapters: SLIDES_CHAPTERS });
    const viewer = await screen.findByTestId("slides-viewer");

    fireEvent.click(within(viewer).getByTestId("slides-close"));

    expect(nav.replace).toHaveBeenCalledWith("/darsliklar/book-1?page=5", { scroll: false });
  });

  it("prezentatsiyasiz yoki noma'lum bo'lim id'si bo'lsa ko'rgich ochilmaydi va URL tozalanadi", async () => {
    setup(`page=5&slides=${NO_SLIDES_ID}&slide=2`, { description: "", chapters: SLIDES_CHAPTERS });

    await currentPage();
    await waitFor(() =>
      expect(nav.replace).toHaveBeenCalledWith("/darsliklar/book-1?page=5", { scroll: false }),
    );
    expect(screen.queryByTestId("slides-viewer")).toBeNull();
  });

  it("mundarijadagi belgi prezentatsiyani ochadi (URL'ga slides va slide yoziladi)", async () => {
    setup("page=5", { description: "", chapters: SLIDES_CHAPTERS });
    await currentPage();
    fireEvent.click(await screen.findByTestId("pdf-toc-open"));

    const buttons = await screen.findAllByTestId("pdf-toc-slides");

    expect(buttons).toHaveLength(1); // prezentatsiyasiz bo'limda belgi yo'q
    fireEvent.click(buttons[0]);
    expect(nav.replace).toHaveBeenCalledWith(
      `/darsliklar/book-1?page=5&slides=${SLIDES_ID}&slide=1`,
      { scroll: false },
    );
  });

  it("prezentatsiyasi yo'q kitob avvalgidek ishlaydi", async () => {
    setup("page=5", { description: "", chapters: CHAPTERS });
    await currentPage();
    fireEvent.click(await screen.findByTestId("pdf-toc-open"));
    await screen.findAllByTestId("pdf-toc-item");

    expect(screen.queryByTestId("pdf-toc-slides")).toBeNull();
    expect(screen.queryByTestId("slides-viewer")).toBeNull();
  });
});

describe("PdfReader: matn qatlami", () => {
  it.each([true, null, undefined])("has_text_layer=%s — qidiruv bor", async (value) => {
    setup("?page=3", { has_text_layer: value });
    await currentPage();
    // Mobilda qidiruv «⋯» menyusida, desktopda sarlavhada.
    fireEvent.click(screen.getByTestId("pdf-more"));
    expect(screen.getByTestId("pdf-find-open")).toBeTruthy();
    cleanup();
    setViewport(true);
    setup("?page=3", { has_text_layer: value });
    expect(await screen.findByTestId("pdf-find-open")).toBeTruthy();
  });

  it("matn qatlami yo'q (skan) — qidiruv, Ctrl+F va / yo'q", async () => {
    setup("?page=3", { has_text_layer: false });
    expect(await currentPage()).toBe("3");
    await screen.findByText("Algebra 9");

    fireEvent.click(screen.getByTestId("pdf-more"));
    expect(screen.queryByTestId("pdf-find-open")).toBeNull();
    fireEvent.keyDown(window, { key: "f", ctrlKey: true });
    fireEvent.keyDown(window, { key: "/" });
    expect(screen.queryByTestId("pdf-find-input")).toBeNull();
  });
});

describe("PdfReader: zoom, pinch va sahifa boshi", () => {
  const zoomOf = () => screen.getByTestId("pdf-zoom-content").dataset.zoom;

  it("kitobda mundarijadan uzoq betga sakrash: shu bet ko'rinadi, sahifa scroll qilinmaydi", async () => {
    const scrollTo = vi.fn();
    window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
    nav.params = new URLSearchParams("page=5");
    api.book.mockResolvedValue({
      id: "book-1",
      title: { uz: "Algebra 9" },
      page_count: 240,
      grade: 9,
      subject: "algebra",
      subject_title: { uz: "Algebra" },
      subject_group: "exact",
      slug: "9-sinf-algebra",
      description: "",
      chapters: CHAPTERS,
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const tree = () => (
      <NextIntlClientProvider locale="uz" messages={uz}>
        <QueryClientProvider client={client}>
          <PdfReader bookId="book-1" />
        </QueryClientProvider>
      </NextIntlClientProvider>
    );
    const view = render(tree());
    expect(await currentPage()).toBe("5");
    expect(scrollTo).not.toHaveBeenCalled();

    // Mundarijadagi «Algebra» (50-bet) bosildi → URL ?page=50.
    nav.params = new URLSearchParams("page=50");
    view.rerender(tree());
    await waitFor(() => expect(currentCanvas()?.dataset.page).toBe("50"));
    // Kitob stage'da qotib turadi — oyna scroll'i yo'q.
    expect(scrollTo).not.toHaveBeenCalled();
    expect(screen.getByTestId("book-announce").textContent).toBe(
      uz.pdfBooks.reader.bookPage.replace("{page}", "50"),
    );
  });

  it("Z klavishi: 100% → 150% → 200% → 300% → 100%; Aa menyusida −/+ va 100%", async () => {
    setup("page=5");
    await currentPage();
    expect(zoomOf()).toBe("1");
    const seen = [];
    for (let i = 0; i < 4; i += 1) {
      fireEvent.keyDown(window, { key: "z" });
      seen.push(zoomOf());
    }
    expect(seen).toEqual(["1.5", "2", "3", "1"]);

    fireEvent.click(screen.getByTestId("pdf-view-open"));
    fireEvent.click(screen.getByRole("button", { name: uz.pdfBooks.appearance.zoomIn }));
    expect(zoomOf()).toBe("1.1");
    const reset = screen.getByTestId("reader-zoom-reset");
    expect(reset.textContent).toBe("110%");
    fireEvent.click(reset);
    expect(zoomOf()).toBe("1");
  });

  it("klaviatura + − 0: 10% qadam, 0 — «Moslash»; tanlov xotiraga yoziladi", async () => {
    setup("page=5");
    await currentPage();
    fireEvent.keyDown(window, { key: "+" });
    fireEvent.keyDown(window, { key: "+" });
    expect(zoomOf()).toBe("1.2");
    fireEvent.keyDown(window, { key: "-" });
    expect(zoomOf()).toBe("1.1");
    expect(window.localStorage.getItem(PREFS_KEY)).toContain('"zoom":1.1');
    fireEvent.keyDown(window, { key: "0" });
    expect(zoomOf()).toBe("1");
  });

  it("kitobda pinch qo'yib yuborilganda zoom holatga yoziladi (3× gacha), swipe bo'lmaydi", async () => {
    setup("page=5");
    await currentPage();
    const area = screen.getByTestId("pdf-page-area");
    const touches = (gap: number) => [
      { clientX: 100, clientY: 200 },
      { clientX: 100 + gap, clientY: 200 },
    ];
    fireEvent.touchStart(area, { touches: touches(100) });
    fireEvent.touchMove(area, { touches: touches(500) });
    fireEvent.touchEnd(area, { touches: [] });
    expect(zoomOf()).toBe("3");
    fireEvent.pointerUp(area, { pointerType: "touch", clientX: 300, clientY: 200 });
    expect(nav.replace).not.toHaveBeenCalledWith("/darsliklar/book-1?page=6", { scroll: false });
  });

  it("uzluksiz rejimda ikki barmoq (pinch): harakat paytida CSS scale, qo'yilganda zoom", async () => {
    storeMode("v");
    setup("page=5");
    await currentPage();
    const area = screen.getByTestId("pdf-page-area");
    const touches = (gap: number) => [
      { clientX: 100, clientY: 200 },
      { clientX: 100 + gap, clientY: 200 },
    ];
    fireEvent.touchStart(area, { touches: touches(100) });
    fireEvent.touchMove(area, { touches: touches(200) });
    expect(screen.getByTestId("pdf-zoom-content").style.transform).toBe("scale(2)");
    fireEvent.touchMove(area, { touches: touches(500) });
    fireEvent.touchEnd(area, { touches: [] });
    expect(zoomOf()).toBe("3");
    expect(screen.getByTestId("pdf-zoom-content").style.transform).toBe("");
    // Pinch tugagan barmoq ko'tarilishi swipe/tap hisoblanmaydi.
    fireEvent.pointerUp(area, { pointerType: "touch", clientX: 300, clientY: 200 });
    expect(nav.replace).not.toHaveBeenCalledWith("/darsliklar/book-1?page=6", { scroll: false });
  });

  it("«⋯» menyusida «Sahifalar», «Oflayn» va «Ulashish»", async () => {
    setup("page=5");
    await currentPage();
    expect(screen.queryByTestId("pdf-share")).toBeNull();
    fireEvent.click(screen.getByTestId("pdf-more"));
    const items = screen.getAllByRole("menuitem").map((item) => item.textContent);
    expect(items).toEqual(
      expect.arrayContaining([
        uz.pdfBooks.reader.pages,
        uz.pdfBooks.reader.offline,
        uz.pdfBooks.reader.share,
      ]),
    );
  });
});

describe("PdfReader: o'qish rejimlari", () => {
  it("standart — kitob: mobilda bitta bet, canvas faqat joriy bet ±2 da", async () => {
    window.localStorage.removeItem(PREFS_KEY);
    setup("page=12");
    expect(await currentPage()).toBe("12");
    expect(screen.getByTestId("pdf-page-area").dataset.mode).toBe("b");
    expect(screen.getByTestId("pdf-zoom-content").dataset.twoPage).toBeUndefined();
    expect(renderedPages()).toEqual([10, 11, 12, 13, 14]);
    const book = screen.getByRole("group", { name: uz.pdfBooks.reader.book });
    expect(book).toBeTruthy();
  });

  it("eski saqlangan «surish» (h) — kitob rejimi", async () => {
    storeMode("h");
    setup("page=12");
    await currentPage();
    expect(screen.getByTestId("pdf-page-area").dataset.mode).toBe("b");
  });

  it("desktopda (≥1024) ochiq kitob: 33-bet 32–33 yoymasida, URL'da chap bet, qo'shnilar oldindan", async () => {
    setViewport(true);
    setup("page=33");
    expect(await currentPage()).toBe("32");
    await waitFor(() =>
      expect(nav.replace).toHaveBeenCalledWith("/darsliklar/book-1?page=32", { scroll: false }),
    );
    expect(screen.getByTestId("pdf-zoom-content").dataset.twoPage).toBe("true");
    const visible = [
      ...document.querySelectorAll('[data-slot="current"] [data-testid="pdf-canvas"]'),
    ];
    expect(visible.map((node) => (node as HTMLElement).dataset.page)).toEqual(["32", "33"]);
    expect(renderedPages().sort((a, b) => a - b)).toEqual([30, 31, 32, 33, 34, 35]);
    expect(screen.getByTestId("book-announce").textContent).toBe(
      uz.pdfBooks.reader.bookPages.replace("{from}", "32").replace("{to}", "33"),
    );
  });

  it("1024px dan tor ekranda bitta bet", async () => {
    setup("page=33");
    await currentPage();
    expect(screen.getByTestId("pdf-zoom-content").dataset.twoPage).toBeUndefined();
  });

  it("ochiq kitobda ← / → / PageDown / Space bir bosishda 2 bet o'tadi", async () => {
    setViewport(true);
    setup("page=32");
    await currentPage();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    fireEvent.keyDown(window, { key: "PageDown" });
    fireEvent.keyDown(window, { key: " " });
    fireEvent.keyDown(window, { key: " ", shiftKey: true });
    const pages = nav.replace.mock.calls.map(([url]) =>
      new URL(url, "http://x").searchParams.get("page"),
    );
    expect(pages).toEqual(["34", "32", "34", "36", "34"]);
  });

  it("ochiq kitobda 1-bet (muqova) yolg'iz: keyingisi — 2", async () => {
    setViewport(true);
    setup("page=1");
    await currentPage();
    expect((screen.getByTestId("pdf-edge-prev") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId("pdf-edge-next"));
    expect(nav.replace).toHaveBeenCalledWith("/darsliklar/book-1?page=2", { scroll: false });
  });

  it("?mode= URL'dan saqlangan tanlovdan ustun", async () => {
    storeMode("b");
    setup("page=12&mode=v");
    await currentPage();
    expect(screen.getByTestId("pdf-page-area").dataset.mode).toBe("v");
  });

  it("rejim almashganda joriy bet saqlanadi va tanlov URL'ga hamda xotiraga yoziladi", async () => {
    setup("page=32");
    await currentPage();
    fireEvent.click(screen.getByTestId("pdf-view-open"));
    fireEvent.click(screen.getByTestId("pdf-mode-v"));
    expect(nav.replace).toHaveBeenCalledWith("/darsliklar/book-1?page=32&mode=v", {
      scroll: false,
    });
    expect(window.localStorage.getItem(PREFS_KEY)).toContain('"mode":"v"');
  });

  it("vertikalda swipe bet almashtirmaydi (oddiy scroll)", async () => {
    storeMode("v");
    setup("page=5");
    await currentPage();
    const area = screen.getByTestId("pdf-page-area");
    fireEvent.pointerDown(area, { pointerType: "touch", clientX: 300, clientY: 100 });
    fireEvent.pointerUp(area, { pointerType: "touch", clientX: 100, clientY: 105 });
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("vertikalda → qo'shni betga o'tadi (bitta bet)", async () => {
    storeMode("v");
    setup("page=5");
    await currentPage();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(nav.replace).toHaveBeenCalledWith("/darsliklar/book-1?page=6", { scroll: false });
  });
});

describe("PdfReader: fokus rejimi, mavzu paneli, suzuvchi panel", () => {
  it("sarlavhada kitob nomi va joriy bo'lim; bosilsa (yoki M) mundarija ochiladi", async () => {
    setup("page=12", { chapters: CHAPTERS });
    await currentPage();
    expect(screen.getByTestId("pdf-current-section").textContent).toBe("Maqsad");
    fireEvent.keyDown(window, { key: "m" });
    expect(await screen.findByTestId("pdf-toc-drawer")).toBeTruthy();
  });

  it("chap sidebar va pastki thumbnail lentasi yo'q", async () => {
    setViewport(true);
    setup("page=12", { chapters: CHAPTERS });
    await currentPage();
    expect(screen.queryByTestId("pdf-sidebar-toggle")).toBeNull();
    expect(screen.queryByTestId("pdf-thumbs-toggle")).toBeNull();
    expect(screen.queryByRole("complementary")).toBeNull();
  });

  it("suzuvchi panel: oldingi/keyingi va slider qo'yib yuborilganda betga o'tadi", async () => {
    setup("page=12", { chapters: CHAPTERS });
    await currentPage();
    fireEvent.click(screen.getByTestId("pdf-next"));
    expect(nav.replace).toHaveBeenLastCalledWith("/darsliklar/book-1?page=13", { scroll: false });
    const slider = screen.getByTestId("reader-slider");
    fireEvent.focus(slider);
    fireEvent.change(slider, { target: { value: "50" } });
    expect(screen.getByTestId("reader-slider-tooltip").textContent).toBe("50-bet · Algebra");
    fireEvent.pointerUp(slider);
    expect(nav.replace).toHaveBeenLastCalledWith("/darsliklar/book-1?page=50", { scroll: false });
    // Bo'lim boshlanishlari (1-betdagisidan tashqari) belgilangan.
    expect(screen.getAllByTestId("reader-slider-marker")).toHaveLength(2);
  });

  it("«Mavzu» joriy bo'lim xulosasini ochadi; «Test» — Test yorlig'ini", async () => {
    setup("page=12", { chapters: CHAPTERS });
    await currentPage();
    fireEvent.click(screen.getByTestId("pdf-topic-open"));
    const panel = await screen.findByTestId("topic-panel");
    expect(await within(panel).findByTestId("summary-blocks")).toBeTruthy();
    expect(await screen.findByTestId("topic-verified")).toBeTruthy();
    fireEvent.keyDown(panel, { key: "Escape" });
    cleanup();

    setup("page=12", { chapters: CHAPTERS });
    await currentPage();
    fireEvent.click(screen.getByTestId("reader-test"));
    const tab = await screen.findByRole("tab", { name: uz.topic.tabs.test });
    expect(tab.getAttribute("aria-selected")).toBe("true");
  });

  it("mundarijasiz kitobda «Mavzu» va «Test» yo'q", async () => {
    setup("page=12", { chapters: [] });
    await currentPage();
    expect(screen.queryByTestId("pdf-topic-open")).toBeNull();
    expect(screen.queryByTestId("reader-test")).toBeNull();
  });

  it("joriy bo'limda mashq bo'lsa «Mashqlar» shu betga o'tadi", async () => {
    setup("page=12", {
      chapters: [
        {
          id: "c1",
          title: "Kirish",
          page: 1,
          children: [
            {
              id: "c1a",
              title: "Maqsad",
              page: 10,
              anchors: [{ kind: "exercise", title: "Mashqlar", page: 16 }],
            },
          ],
        },
      ],
    });
    await currentPage();
    fireEvent.click(screen.getByTestId("reader-exercises"));
    expect(nav.replace).toHaveBeenLastCalledWith("/darsliklar/book-1?page=16", { scroll: false });
  });

  it("Aa sozlamalari xotiraga yoziladi: fon, iliq rang", async () => {
    setup("page=12");
    await currentPage();
    fireEvent.click(screen.getByTestId("pdf-view-open"));
    fireEvent.click(screen.getByTestId("reader-tone-sepia"));
    fireEvent.click(screen.getByTestId("reader-warm"));
    expect(screen.getByTestId("pdf-reader").dataset.tone).toBe("sepia");
    expect(screen.getByTestId("pdf-reader").dataset.warm).toBe("true");
    const stored = window.localStorage.getItem(PREFS_KEY) ?? "";
    expect(stored).toContain('"tone":"sepia"');
    expect(stored).toContain('"warm":true');
  });
});
