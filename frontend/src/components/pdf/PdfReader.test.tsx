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
  usePdfDocument: () => ({ doc: { numPages: 240 }, loading: false, error: null, reload: vi.fn() }),
  useSlidesDocument: () => ({ doc: { numPages: 8 }, loading: false, error: null, reload: vi.fn() }),
}));
vi.mock("./PdfPageCanvas", () => ({
  PdfPageCanvas: ({ pageNumber }: { pageNumber: number }) => (
    <div data-testid="pdf-canvas" data-page={pageNumber} />
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

/** Panelni ochib «Tavsif» yorlig'iga o'tadi. */
const openAbout = async () => {
  fireEvent.click(await screen.findByTestId("pdf-toc-open"));
  fireEvent.click(await screen.findByTestId("reader-tab-about"));
};

const currentPage = async () => (await screen.findByTestId("pdf-canvas")).dataset.page;

beforeEach(() => {
  vi.clearAllMocks();
  // Mundarija paneli (useMediaQuery) uchun: jsdom'da matchMedia yo'q; <dialog> usullari ham.
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close")); // jsdom bermaydi; brauzerda Esc/close() shuni chiqaradi
  };
  progress.state = { ready: true, position: null, resume: 1, record: vi.fn() };
});
afterEach(cleanup);

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
    expect(screen.queryByTestId("pdf-canvas")).toBeNull();
  });

  it("← / → klavishlari sahifani suradi", async () => {
    setup("page=5");
    await currentPage();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(nav.replace).toHaveBeenNthCalledWith(1, "/darsliklar/book-1?page=6", {
      scroll: false,
    });
    expect(nav.replace).toHaveBeenNthCalledWith(2, "/darsliklar/book-1?page=4", {
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
    const canvas = await screen.findByTestId("pdf-canvas");
    const area = canvas.parentElement as HTMLElement;
    const swipe = (fromX: number, toX: number) => {
      fireEvent.pointerDown(area, { pointerType: "touch", clientX: fromX, clientY: 100 });
      fireEvent.pointerUp(area, { pointerType: "touch", clientX: toX, clientY: 105 });
    };
    swipe(300, 100);
    swipe(100, 300);
    expect(nav.replace).toHaveBeenNthCalledWith(1, "/darsliklar/book-1?page=6", {
      scroll: false,
    });
    expect(nav.replace).toHaveBeenNthCalledWith(2, "/darsliklar/book-1?page=4", {
      scroll: false,
    });
  });

  it("sichqoncha harakati swipe hisoblanmaydi", async () => {
    setup("page=5");
    const area = (await screen.findByTestId("pdf-canvas")).parentElement as HTMLElement;
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

describe("PdfReader: mundarija va tavsif", () => {
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
    const toc = screen.getByTestId("pdf-toc");
    expect(items.map((item) => item.textContent)).toEqual([
      "Kirish1-bet",
      "Maqsad10-bet",
      "Algebra50-bet",
    ]);
    fireEvent.click(items[2]);
    expect(nav.replace).toHaveBeenCalledWith("/darsliklar/book-1?page=50", { scroll: false });
    await waitFor(() => expect(toc.closest("dialog")?.hasAttribute("open")).toBe(false));
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

  it("qisqa tavsif to'liq ko'rinadi, uzuni «Batafsil» bilan kengayadi", async () => {
    const long = "Uzun tavsif. ".repeat(30);
    setup("page=1", { description: long, chapters: [] });
    await currentPage();
    await openAbout();
    const more = await screen.findByRole("button", { name: uz.pdfBooks.description.more });
    expect(more.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByTestId("pdf-description").querySelector("p")?.className).toContain(
      "line-clamp-2",
    );
    fireEvent.click(more);
    expect(
      screen
        .getByRole("button", { name: uz.pdfBooks.description.less })
        .getAttribute("aria-expanded"),
    ).toBe("true");
    expect(screen.getByTestId("pdf-description").querySelector("p")?.className).not.toContain(
      "line-clamp-2",
    );
  });

  it("qisqa tavsifda «Batafsil» tugmasi yo'q; tavsif bo'lmasa blok yo'q", async () => {
    setup("page=1", { description: "Qisqa tavsif", chapters: [] });
    await currentPage();
    await openAbout();
    expect(await screen.findByText("Qisqa tavsif")).toBeTruthy();
    expect(screen.queryByRole("button", { name: uz.pdfBooks.description.more })).toBeNull();
    cleanup();
    setup("page=1", { description: "", chapters: [] });
    await currentPage();
    fireEvent.click(await screen.findByTestId("pdf-toc-open"));
    expect(screen.queryByTestId("reader-tab-about")).toBeNull();
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
  it.each([true, null, undefined])("has_text_layer=%s — qidiruv tugmasi bor", async (value) => {
    setup("?page=3", { has_text_layer: value });
    expect(await screen.findByTestId("pdf-find-open")).toBeTruthy();
  });

  it("matn qatlami yo'q (skan) — qidiruv tugmasi va Ctrl+F yo'q", async () => {
    setup("?page=3", { has_text_layer: false });
    expect(await currentPage()).toBe("3");
    await screen.findByText("Algebra 9");

    expect(screen.queryByTestId("pdf-find-open")).toBeNull();
    fireEvent.keyDown(window, { key: "f", ctrlKey: true });
    expect(screen.queryByTestId("pdf-find-input")).toBeNull();
  });
});

describe("PdfReader: zoom, pinch va sahifa boshi", () => {
  const zoomOf = () => screen.getByTestId("pdf-zoom-content").dataset.zoom;

  it("mundarijadan boshqa betga o'tilsa sahifa boshidan ochiladi (birinchi ochilishda emas)", async () => {
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
    await waitFor(() => expect(screen.getByTestId("pdf-canvas").dataset.page).toBe("50"));
    expect(scrollTo).toHaveBeenCalledWith({ top: 0 });
  });

  it("pastki paneldagi «Zoom»: 1× → 1.5× → 2× → 3× → 1×", async () => {
    setup("page=5");
    await currentPage();
    const button = screen.getByTestId("pdf-zoom-bar");
    expect(zoomOf()).toBe("1");
    const seen = [];
    for (let i = 0; i < 4; i += 1) {
      fireEvent.click(button);
      seen.push(zoomOf());
    }
    expect(seen).toEqual(["1.5", "2", "3", "1"]);
    fireEvent.click(button);
    expect(button.textContent).toContain("1.5×");
  });

  it("ikki barmoq (pinch): harakat paytida CSS scale, qo'yib yuborilganda zoom (3× gacha)", async () => {
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

  it("«⋯» menyusida «Oflayn» va «Ulashish»", async () => {
    setup("page=5");
    await currentPage();
    expect(screen.queryByTestId("pdf-share")).toBeNull();
    fireEvent.click(screen.getByTestId("pdf-bar-more"));
    const items = screen.getAllByRole("menuitem").map((item) => item.textContent);
    expect(items).toEqual([uz.pdfBooks.reader.offline, uz.pdfBooks.reader.share]);
  });
});
