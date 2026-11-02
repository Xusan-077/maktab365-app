// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
/** Hujjat ochilmagan holat (xato testlari uchun): `null` — odatdagidek ochilgan. */
const docFailure = vi.hoisted(() => ({ error: null as unknown, reload: vi.fn() }));

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
// Sessiya: mehmon (chizmalar qurilmada, `useDrawings`).
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ status: "unauthenticated", signedIn: false, sessionUser: null }),
}));
// Kutubxona kitobi (`library`) yo'li bu testlarda ishlatilmaydi.
vi.mock("@/hooks/useBookProgress", () => ({
  useBookProgress: () => ({ ready: true, lastPage: null, position: null, save: vi.fn() }),
}));
// Kirgan foydalanuvchi: saqlash amallari darhol bajariladi.
vi.mock("@/hooks/useRequireAuth", () => ({
  useRequireAuth: () => (action?: () => void) => {
    action?.();
    return true;
  },
}));
vi.mock("@/hooks/usePdfAnnotations", () => ({
  usePdfAnnotations: () => ({
    items: [],
    save: vi.fn(),
    remove: vi.fn(),
    removeAll: vi.fn(),
    restore: vi.fn(),
  }),
}));
vi.mock("@/lib/pdf-books/api", () => ({
  getPdfBooksApi: () => api,
  PDF_PAGE_SIZE: 24,
}));
vi.mock("./PdfBookmarkButton", () => ({ PdfBookmarkButton: () => null }));
vi.mock("@/components/support/ReportErrorLink", () => ({ ReportErrorLink: () => null }));
vi.mock("@/components/games/TopicGamesBlock", () => ({ TopicGamesBlock: () => null }));
vi.mock("./usePdfDocument", () => ({
  usePdfDocument: () =>
    docFailure.error
      ? { doc: null, loading: false, error: docFailure.error, reload: docFailure.reload }
      : { doc: pdfDoc, loading: false, error: null, reload: vi.fn() },
  useSlidesDocument: () => ({ doc: { numPages: 8 }, loading: false, error: null, reload: vi.fn() }),
  useLibraryBookDocument: () => ({ doc: null, loading: false, error: null, reload: vi.fn() }),
}));
vi.mock("./PdfPageCanvas", () => ({
  PdfPageCanvas: ({
    pageNumber,
    current,
    overlay,
  }: {
    pageNumber: number;
    current?: boolean;
    overlay?: ReactNode;
  }) => (
    <div data-testid="pdf-canvas" data-page={pageNumber} data-current={current || undefined}>
      {overlay}
    </div>
  ),
}));

import type { Annotation } from "@/lib/books/annotations";
import { selectPageItems, useBookAnnotationsStore } from "@/stores/book-annotations.store";
import { useToastStore } from "@/stores/toast.store";
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
const ZOOM_MEMORY_KEY = "maktab365-zoom";
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
  docFailure.error = null;
  // Mundarija paneli (useMediaQuery) uchun: jsdom'da matchMedia yo'q; <dialog> usullari ham.
  setViewport(false);
  // Mavjud testlar bitta betli kitob rejimida (mobil + saqlangan "b").
  storeMode("b");
  // Zoom kitob bo'yicha saqlanadi: oldingi testning zoom'i keyingisiga o'tmasin.
  window.localStorage.removeItem(ZOOM_MEMORY_KEY);
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

  it("PDF ochilmasa: sababi tushunarli, «Qayta urinish» — va brauzerda ochish yo'li umuman yo'q", async () => {
    const errors = uz.pdfBooks.reader.loadErrors;
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);
    for (const mode of ["b", "v"] as const) {
      storeMode(mode);
      docFailure.error = Object.assign(new Error("x"), { name: "InvalidPDFException" });
      setup("page=5");
      const alert = await screen.findByTestId("pdf-load-error");
      expect(alert.dataset.problem).toBe("damaged");
      expect(alert.textContent).toContain(errors.title);
      expect(alert.textContent).toContain(errors.damaged);
      // Faqat ikkita harakat: qayta urinish va darsliklar ro'yxati — PDF fayliga havola yo'q.
      expect(
        within(alert)
          .getAllByRole("button")
          .map((node) => node.textContent),
      ).toEqual([uz.pdfBooks.reader.retry]);
      expect(
        within(alert)
          .getAllByRole("link")
          .map((node) => node.textContent),
      ).toEqual([errors.catalog]);
      expect(within(alert).getByRole("link").getAttribute("href")).not.toMatch(/\.pdf|file|blob/i);
      fireEvent.click(screen.getByTestId("pdf-load-retry"));
      expect(docFailure.reload).toHaveBeenCalled();
      cleanup();
      docFailure.reload.mockClear();
    }
    expect(openSpy).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain("PDFni yangi oynada");
  });

  it("PDF juda uzoq yuklansa — «sekin internet» xabari", async () => {
    const { PdfLoadTimeoutError } = await import("@/lib/pdf/load-error");
    docFailure.error = new PdfLoadTimeoutError();
    setup("page=5");
    const alert = await screen.findByTestId("pdf-load-error");
    expect(alert.dataset.problem).toBe("timeout");
    expect(alert.textContent).toContain(uz.pdfBooks.reader.loadErrors.timeout);
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

  it("Z klavishi: 100% → 150% → 200% → 300% → 400% → 100%; Aa menyusida −/+ va 100%", async () => {
    setup("page=5");
    await currentPage();
    expect(zoomOf()).toBe("1");
    const seen = [];
    for (let i = 0; i < 5; i += 1) {
      fireEvent.keyDown(window, { key: "z" });
      seen.push(zoomOf());
    }
    expect(seen).toEqual(["1.5", "2", "3", "4", "1"]);

    fireEvent.click(screen.getByTestId("pdf-view-open"));
    // Sarlavhadagi zoom guruhida ham «Kattalashtirish» bor: Aa menyusidagisi olinadi.
    const reset = screen.getByTestId("reader-zoom-reset");
    const menu = within(reset.parentElement as HTMLElement);
    fireEvent.click(menu.getByRole("button", { name: uz.pdfBooks.appearance.zoomIn }));
    expect(zoomOf()).toBe("1.25");
    expect(reset.textContent).toBe("125%");
    fireEvent.click(reset);
    expect(zoomOf()).toBe("1");
  });

  it("klaviatura + − 0: 25% qadam, 0 — «Moslash»; zoom shu kitob uchun xotiraga yoziladi", async () => {
    setup("page=5");
    await currentPage();
    fireEvent.keyDown(window, { key: "+" });
    fireEvent.keyDown(window, { key: "+" });
    expect(zoomOf()).toBe("1.5");
    fireEvent.keyDown(window, { key: "-" });
    expect(zoomOf()).toBe("1.25");
    expect(window.localStorage.getItem(ZOOM_MEMORY_KEY)).toContain('"book-1":1.25');
    fireEvent.keyDown(window, { key: "0" });
    expect(zoomOf()).toBe("1");
  });

  it("kitobda pinch qo'yib yuborilganda zoom holatga yoziladi (4× gacha), swipe bo'lmaydi", async () => {
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
    expect(zoomOf()).toBe("4");
    fireEvent.pointerUp(area, { pointerType: "touch", clientX: 300, clientY: 200 });
    expect(nav.replace).not.toHaveBeenCalledWith("/darsliklar/book-1?page=6", { scroll: false });
  });

  it("uzluksiz rejimda ikki barmoq (pinch): harakat paytida faqat CSS scale (holat o'zgarmaydi), qo'yilganda bir marta zoom", async () => {
    storeMode("v");
    setup("page=5");
    await currentPage();
    const area = screen.getByTestId("pdf-page-area");
    const content = () => screen.getByTestId("pdf-zoom-content");
    const nextFrame = () =>
      act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
    const touches = (gap: number) => [
      { clientX: 100, clientY: 200 },
      { clientX: 100 + gap, clientY: 200 },
    ];
    fireEvent.touchStart(area, { touches: touches(100) });
    fireEvent.touchMove(area, { touches: touches(150) });
    fireEvent.touchMove(area, { touches: touches(200) });
    await nextFrame();
    // Bir kadrda bir marta, oxirgi qiymat bilan; GPU qatlami; layout (eni) va holat o'zgarmagan.
    expect(content().style.transform).toBe("scale(2)");
    expect(content().style.willChange).toBe("transform");
    expect(zoomOf()).toBe("1");
    fireEvent.touchMove(area, { touches: touches(500) });
    fireEvent.touchEnd(area, { touches: [] });
    expect(zoomOf()).toBe("4");
    expect(content().style.transform).toBe("");
    expect(content().style.willChange).toBe("");
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
    // Holat `null`: Next ichki holati uzatilsa `useSearchParams` yangilanmay qoladi.
    expect(
      vi.mocked(window.history.replaceState).mock.calls.every(([state]) => state === null),
    ).toBe(true);
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

describe("PdfReader: zoom kitob bo'yicha eslab qolinadi", () => {
  const zoomOf = () => screen.getByTestId("pdf-zoom-content").dataset.zoom;
  it("saqlangan zoom bilan ochiladi, saqlanmagan kitob — «Moslash» (100%)", async () => {
    window.localStorage.setItem(ZOOM_MEMORY_KEY, JSON.stringify({ "book-1": 2.5 }));
    setup("page=5");
    await currentPage();
    expect(zoomOf()).toBe("2.5");
  });

  it("kitob kattalashganda swipe, chekka va sichqoncha bilan sudrash bet almashtirmaydi", async () => {
    window.localStorage.setItem(ZOOM_MEMORY_KEY, JSON.stringify({ "book-1": 2 }));
    setup("page=5");
    await currentPage();
    expect(zoomOf()).toBe("2");
    // Chekka tugmalari yo'q: surish ular ustidan boshlansa «bosish» bo'lib qolardi.
    expect(screen.queryByTestId("pdf-edge-next")).toBeNull();
    expect(screen.queryByTestId("pdf-edge-prev")).toBeNull();
    const area = screen.getByTestId("pdf-page-area");
    for (const pointerType of ["touch", "mouse"]) {
      for (const [fromX, toX] of [
        [300, 20],
        [20, 300],
        [2, 2],
      ]) {
        fireEvent.pointerDown(area, { pointerType, pointerId: 1, clientX: fromX, clientY: 100 });
        fireEvent.pointerMove(area, { pointerType, pointerId: 1, clientX: toX, clientY: 104 });
        fireEvent.pointerUp(area, { pointerType, pointerId: 1, clientX: toX, clientY: 104 });
      }
    }
    expect(nav.replace).not.toHaveBeenCalled();
  });

  const wheel = (target: EventTarget, init: WheelEventInit) => {
    const event = new WheelEvent("wheel", { bubbles: true, cancelable: true, ...init });
    act(() => void target.dispatchEvent(event));
    return event;
  };

  it("Ctrl/⌘+g'ildirak (trackpad pinch) brauzer zoom'ini to'xtatadi — ikkala rejimda, sarlavha ustida ham", async () => {
    for (const mode of ["b", "v"] as const) {
      storeMode(mode);
      setup("page=5");
      await currentPage();
      const area = screen.getByTestId("pdf-page-area");
      expect(wheel(area, { ctrlKey: true, deltaY: -40 }).defaultPrevented).toBe(true);
      expect(wheel(area, { metaKey: true, deltaY: 40 }).defaultPrevented).toBe(true);
      expect(wheel(document.body, { ctrlKey: true, deltaY: -40 }).defaultPrevented).toBe(true);
      // Safari: trackpad pinch — `gesture*` hodisalari.
      const gesture = new Event("gesturestart", { cancelable: true });
      act(() => void window.dispatchEvent(gesture));
      expect(gesture.defaultPrevented).toBe(true);
      act(() => void window.dispatchEvent(new Event("gestureend", { cancelable: true })));
      expect(nav.replace).not.toHaveBeenCalled();
      cleanup();
    }
  });

  it("uzluksiz rejimda Safari pinch (gesture*) zoom'ni o'zgartiradi, bet almashmaydi", async () => {
    storeMode("v");
    setup("page=5");
    await currentPage();
    const gesture = (type: string, scale: number) =>
      act(() => {
        const event = Object.assign(new Event(type, { cancelable: true }), {
          scale,
          clientX: 100,
          clientY: 200,
        });
        window.dispatchEvent(event);
      });
    gesture("gesturestart", 1);
    gesture("gesturechange", 2);
    gesture("gestureend", 2);
    expect(zoomOf()).toBe("2");
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("kitob 100% dan katta: g'ildirak/trackpad faqat betni suradi, varaq ag'darilmaydi", async () => {
    window.localStorage.setItem(ZOOM_MEMORY_KEY, JSON.stringify({ "book-1": 2 }));
    setup("page=5");
    await currentPage();
    const area = screen.getByTestId("pdf-page-area");
    for (const init of [{ deltaY: 900 }, { deltaY: -900 }, { deltaX: 900 }, { deltaX: -900 }]) {
      expect(wheel(area, init).defaultPrevented).toBe(true);
    }
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("swipe o'rtasida ikkinchi barmoq (pinch) tegsa — swipe bekor, qolgan barmoq ham swipe emas", async () => {
    setup("page=5");
    await currentPage();
    const area = screen.getByTestId("pdf-page-area");
    fireEvent.pointerDown(area, { pointerType: "touch", pointerId: 1, clientX: 300, clientY: 200 });
    // Ikkinchi barmoqning `pointerdown` i kelmagan holat ham (faqat `touchstart`).
    fireEvent.touchStart(area, {
      touches: [
        { clientX: 300, clientY: 200 },
        { clientX: 400, clientY: 200 },
      ],
    });
    fireEvent.pointerMove(area, { pointerType: "touch", pointerId: 1, clientX: 200, clientY: 200 });
    fireEvent.touchEnd(area, { touches: [{ clientX: 200, clientY: 200 }] });
    fireEvent.pointerUp(area, { pointerType: "touch", pointerId: 1, clientX: 60, clientY: 200 });
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("kitob kichraytirilganda (100% dan past) ham swipe bet almashtirmaydi", async () => {
    window.localStorage.setItem(ZOOM_MEMORY_KEY, JSON.stringify({ "book-1": 0.7 }));
    setup("page=5");
    await currentPage();
    const area = screen.getByTestId("pdf-page-area");
    fireEvent.pointerDown(area, { pointerType: "touch", clientX: 300, clientY: 100 });
    fireEvent.pointerUp(area, { pointerType: "touch", clientX: 100, clientY: 105 });
    expect(nav.replace).not.toHaveBeenCalled();
    // Tugmalar (kitob chetni yopmaydi) ishlaydi.
    fireEvent.click(screen.getByTestId("pdf-edge-next"));
    expect(nav.replace).toHaveBeenCalledWith("/darsliklar/book-1?page=6", { scroll: false });
  });

  it("boshqa kitobning zoom'i bu kitobga o'tmaydi", async () => {
    window.localStorage.setItem(ZOOM_MEMORY_KEY, JSON.stringify({ "book-2": 3 }));
    setup("page=5");
    await currentPage();
    expect(zoomOf()).toBe("1");
  });
});

describe("PdfReader: chizish rejimi", () => {
  it("tugma panelni ochadi (pastki navigatsiya o'rnida), Esc yopadi", async () => {
    setup("page=5");
    await currentPage();
    expect(screen.queryByTestId("draw-toolbar")).toBeNull();
    fireEvent.click(screen.getByTestId("draw-toggle"));
    expect(screen.getByTestId("draw-toggle").getAttribute("aria-pressed")).toBe("true");
    const toolbar = await screen.findByTestId("draw-toolbar");
    expect(screen.queryByTestId("reader-floating-nav")).toBeNull();
    // Qalam, marker, o'chirgich; 6 ta rang va 3 ta qalinlik.
    expect(within(toolbar).getByTestId("draw-tool-pen").getAttribute("aria-pressed")).toBe("true");
    expect(within(toolbar).getAllByTestId("draw-color")).toHaveLength(6);
    expect(within(toolbar).getAllByTestId("draw-width")).toHaveLength(3);
    fireEvent.click(within(toolbar).getByTestId("draw-tool-marker"));
    expect(within(toolbar).getAllByTestId("draw-color")).toHaveLength(6);
    // Chizmalar faqat shu qurilmada (kirish so'ralmaydi); bo'sh betni tozalab bo'lmaydi.
    expect(within(toolbar).getByTestId("draw-save-status").dataset.state).toBe("local");
    expect(within(toolbar).queryByTestId("draw-sign-in")).toBeNull();
    expect(within(toolbar).getByTestId("draw-clear-page").hasAttribute("disabled")).toBe(true);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("draw-toolbar")).toBeNull();
    expect(screen.getByTestId("reader-floating-nav")).toBeTruthy();
  });

  it("«Betni tozalash» joriy betni tozalaydi va «Qaytarish» chizmalarni qaytaradi", async () => {
    setup("page=5");
    await currentPage();
    fireEvent.click(screen.getByTestId("draw-toggle"));
    const toolbar = await screen.findByTestId("draw-toolbar");
    const stroke = {
      id: "s1",
      type: "drawing",
      data: { tool: "pen", color: "ink", width: 0.004, points: [[0.1, 0.1, 0.5]] },
    } as Annotation;
    act(() => useBookAnnotationsStore.getState().commit(5, [stroke]));
    const clear = within(toolbar).getByTestId("draw-clear-page");
    await waitFor(() => expect(clear.hasAttribute("disabled")).toBe(false));
    fireEvent.click(clear);
    expect(selectPageItems(5)(useBookAnnotationsStore.getState())).toHaveLength(0);
    const toast = useToastStore.getState().toasts.at(-1);
    expect(toast?.title).toBe(uz.pdfBooks.draw.pageCleared);
    act(() => toast?.action?.onClick());
    expect(selectPageItems(5)(useBookAnnotationsStore.getState()).map((i) => i.id)).toEqual(["s1"]);
  });

  it("chizish qatlami faqat joriy bet ±1 da (rejim yoqilganda)", async () => {
    storeMode("v");
    setup("page=5");
    await currentPage();
    fireEvent.click(screen.getByTestId("draw-toggle"));
    await waitFor(() =>
      expect(document.querySelectorAll("[data-draw-layer]").length).toBeGreaterThan(0),
    );
    expect(document.querySelectorAll("[data-draw-layer]").length).toBeLessThanOrEqual(3);
  });
});
