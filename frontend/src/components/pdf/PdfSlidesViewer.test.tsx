// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import uz from "@/lib/i18n/messages/uz.json";

const docState = vi.hoisted(() => ({
  value: {
    doc: { numPages: 5 } as unknown,
    loading: false,
    error: null as unknown,
    reload: vi.fn(),
  },
}));

vi.mock("./usePdfDocument", () => ({ useSlidesDocument: () => docState.value }));
vi.mock("./PdfPageCanvas", () => ({
  PdfPageCanvas: ({ pageNumber, fit }: { pageNumber: number; fit?: string }) => (
    <div data-testid="pdf-canvas" data-page={pageNumber} data-fit={fit} />
  ),
}));

import { PdfSlidesViewer } from "./PdfSlidesViewer";

const ID = "3f2b8c1e-5d4a-4c7e-9a10-0b6f1d2e3c4d";
const t = uz.pdfBooks.slides;

function setup(slide = 2, slideCount = 5) {
  const handlers = { onSlide: vi.fn(), onClose: vi.fn(), onBackToBook: vi.fn() };
  render(
    <NextIntlClientProvider locale="uz" messages={uz}>
      <PdfSlidesViewer
        bookId="book-1"
        chapterId={ID}
        title="Algebra"
        slideCount={slideCount}
        slide={slide}
        {...handlers}
      />
    </NextIntlClientProvider>,
  );
  return handlers;
}

const viewer = () => screen.getByTestId("slides-viewer");

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  docState.value = { doc: { numPages: 5 }, loading: false, error: null, reload: vi.fn() };
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});
afterEach(cleanup);

describe("PdfSlidesViewer", () => {
  it("modal dialog sifatida ochiladi, nomi bo'lim sarlavhasi, slayd ekranga sig'adi (contain)", () => {
    setup();
    expect(viewer().hasAttribute("open")).toBe(true);
    expect(viewer().getAttribute("aria-label")).toBe("Prezentatsiya: Algebra");
    expect(screen.getByRole("heading", { name: "Algebra", hidden: true })).toBeTruthy();
    const canvas = screen.getByTestId("pdf-canvas");
    expect(canvas.dataset.page).toBe("2");
    expect(canvas.dataset.fit).toBe("contain");
  });

  it("«N / jami» ko'rsatadi, tugmalar nomli", () => {
    setup(3);
    expect(screen.getByTestId("slides-position").textContent).toContain("3 / 5");
    expect(screen.getByRole("button", { name: t.prev, hidden: true })).toBeTruthy();
    expect(screen.getByRole("button", { name: t.next, hidden: true })).toBeTruthy();
    expect(screen.getByRole("button", { name: t.close, hidden: true })).toBeTruthy();
  });

  it("oldingi/keyingi tugmalari slaydni o'zgartiradi", () => {
    const { onSlide } = setup(2);
    fireEvent.click(screen.getByTestId("slides-next"));
    fireEvent.click(screen.getByTestId("slides-prev"));
    expect(onSlide).toHaveBeenNthCalledWith(1, 3);
    expect(onSlide).toHaveBeenNthCalledWith(2, 1);
  });

  it("birinchi/oxirgi slaydda tegishli tugma o'chiq", () => {
    setup(1);
    expect((screen.getByTestId("slides-prev") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId("slides-next") as HTMLButtonElement).disabled).toBe(false);
    cleanup();
    setup(5);
    expect((screen.getByTestId("slides-next") as HTMLButtonElement).disabled).toBe(true);
  });

  it("klaviatura: ←/→, PageUp/PageDown, Home/End; brauzer harakati bekor qilinadi", () => {
    const { onSlide } = setup(3);
    const press = (key: string) => {
      const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
      viewer().dispatchEvent(event);
      return event;
    };

    expect(press("ArrowRight").defaultPrevented).toBe(true);
    press("ArrowLeft");
    press("PageDown");
    press("PageUp");
    press("Home");
    press("End");

    expect(onSlide.mock.calls.map(([n]) => n)).toEqual([4, 2, 4, 2, 1, 5]);
    expect(press("a").defaultPrevented).toBe(false);
  });

  it("chegaradan tashqariga o'tmaydi", () => {
    const { onSlide } = setup(5);
    viewer().dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }),
    );
    expect(onSlide).not.toHaveBeenCalled();
  });

  it("«Kitobga qaytish» va «Yopish» alohida qayta chaqiruvlar", () => {
    const { onBackToBook, onClose } = setup();
    fireEvent.click(screen.getByTestId("slides-back"));
    expect(onBackToBook).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("slides-close"));
    expect(onClose).toHaveBeenCalledTimes(1); // dialog yopilishi (Esc ham shu `close` hodisasi)
  });

  it("URL'dagi slayd jamidan katta bo'lsa hujjat ochilgach tuzatiladi", () => {
    const { onSlide } = setup(99);
    expect(onSlide).toHaveBeenCalledWith(5);
    expect(screen.getByTestId("pdf-canvas").dataset.page).toBe("5");
  });

  it("oxirgi ko'rilgan slayd brauzerda eslab qolinadi", () => {
    setup(4);
    expect(window.localStorage.getItem(`maktab365-slides:${ID}`)).toBe("4");
  });

  it("hujjat yuklanguncha holat va serverdagi slaydlar soni ko'rinadi", () => {
    docState.value = { doc: null, loading: true, error: null, reload: vi.fn() };
    setup(1, 12);
    expect(screen.getByRole("status", { name: t.loading, hidden: true })).toBeTruthy();
    expect(screen.getByTestId("slides-position").textContent).toContain("1 / 12");
    expect(window.localStorage.getItem(`maktab365-slides:${ID}`)).toBeNull();
  });

  it("yuklash xatosida xabar va «Qayta urinish»", () => {
    const reload = vi.fn();
    docState.value = { doc: null, loading: false, error: new Error("x"), reload };
    setup();

    expect(screen.getByRole("alert", { hidden: true }).textContent).toContain(t.loadError);
    fireEvent.click(screen.getByRole("button", { name: t.retry, hidden: true }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("telefonda chapga surish — keyingi, o'ngga — oldingi slayd", () => {
    const { onSlide } = setup(3);
    const area = screen.getByTestId("pdf-canvas").parentElement as HTMLElement;
    const swipe = (fromX: number, toX: number) => {
      fireEvent.pointerDown(area, { pointerType: "touch", clientX: fromX, clientY: 100 });
      fireEvent.pointerUp(area, { pointerType: "touch", clientX: toX, clientY: 104 });
    };

    swipe(300, 100);
    swipe(100, 300);

    expect(onSlide.mock.calls.map(([n]) => n)).toEqual([4, 2]);
  });

  it("to'liq ekran tugmasi faqat brauzer qo'llab-quvvatlasa ko'rinadi", () => {
    setup();
    expect(screen.queryByTestId("slides-fullscreen")).toBeNull(); // jsdom'da yo'q
    cleanup();

    Object.defineProperty(document, "fullscreenEnabled", { value: true, configurable: true });
    const request = vi.fn().mockResolvedValue(undefined);
    HTMLElement.prototype.requestFullscreen = request;
    try {
      setup();
      fireEvent.click(screen.getByTestId("slides-fullscreen"));
      expect(request).toHaveBeenCalled();
    } finally {
      Object.defineProperty(document, "fullscreenEnabled", {
        value: undefined,
        configurable: true,
      });
    }
  });
});
