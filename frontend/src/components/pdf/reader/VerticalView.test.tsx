// @vitest-environment jsdom
import { createRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import type { PDFDocumentProxy } from "@/lib/pdf/pdfjs";
import { VerticalView, type VerticalViewProps } from "./VerticalView";

/** A4 nisbatidagi 20 betlik soxta hujjat. */
const doc = {
  numPages: 20,
  getPage: async () => ({ getViewport: () => ({ width: 100, height: 141.4 }) }),
} as unknown as PDFDocumentProxy;

const scrolled: number[] = [];

function props(overrides: Partial<VerticalViewProps> = {}): VerticalViewProps {
  return {
    doc,
    page: 1,
    total: 20,
    zoom: 1,
    fullscreen: false,
    stageRef: createRef(),
    scrollerRef: createRef(),
    contentRef: createRef(),
    onPageChange: vi.fn(),
    renderPage: (number) => <div data-testid={`page-${number}`} />,
    fit: "width",
    pageReserve: 120,
    ...overrides,
  };
}

beforeEach(() => {
  scrolled.length = 0;
  // jsdom'da layout yo'q: konteyner eni va `scrollIntoView` qo'lda beriladi.
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(800);
  HTMLElement.prototype.scrollIntoView = function scrollIntoView() {
    scrolled.push(Number((this as HTMLElement).dataset.pageSlot));
  };
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("VerticalView: masshtab rejimi o'zgarganda", () => {
  it("joriy bet joyida qoladi (eni ↔ butun bet)", async () => {
    const { rerender } = render(<VerticalView {...props({ page: 5 })} />);
    await act(async () => undefined);
    rerender(<VerticalView {...props({ page: 7 })} />);
    await act(async () => undefined);
    expect(scrolled.at(-1)).toBe(7);

    // Regressiya: betlar balandligi o'zgarib, eski piksel scroll boshqa betga (7 → 9) tushardi.
    scrolled.length = 0;
    rerender(<VerticalView {...props({ page: 7, fit: "page" })} />);
    await act(async () => undefined);
    expect(scrolled).toEqual([7]);

    scrolled.length = 0;
    rerender(<VerticalView {...props({ page: 7, fit: "width" })} />);
    await act(async () => undefined);
    expect(scrolled).toEqual([7]);
  });

  it("zoom paytida va qo'llangach 400 ms joriy bet qayta hisoblanmaydi (keyin — bir marta)", async () => {
    // Ro'yxat tepasi ekran markazidan `offset` px yuqorida: bet 800×1131 px, oraliq 14 px →
    // 9 500 px — 9-bet, 13 000 px — 12-bet markazda.
    let offset = 9500;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => ({
      top: window.innerHeight / 2 - offset,
      left: 0,
      width: 800,
      height: 1131,
      right: 800,
      bottom: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }));
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    const scroll = () => act(() => void window.dispatchEvent(new Event("scroll")));
    const onPageChange = vi.fn();
    // Gesture holati ref'da (`useReaderZoom`): React prop'i o'zgarmaydi, faqat funksiya natijasi.
    let zooming = false;
    const isZooming = () => zooming;
    const view = (overrides: Partial<VerticalViewProps>) => (
      <VerticalView {...props({ page: 5, onPageChange, isZooming, ...overrides })} />
    );
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] });
    try {
      const { rerender } = render(view({}));
      await act(async () => undefined);
      // Nazorat: zoom'siz oddiy scroll odatdagidek yoziladi (300 ms debounce).
      act(() => void vi.advanceTimersByTime(1000));
      scroll();
      act(() => void vi.advanceTimersByTime(400));
      expect(onPageChange).toHaveBeenCalledWith(9);
      onPageChange.mockClear();
      offset = 13000;

      // Pinch/Ctrl+g'ildirak (CSS scale, qayta render yo'q): scroll bo'lsa ham bet yozilmaydi.
      zooming = true;
      scroll();
      act(() => void vi.advanceTimersByTime(1000));
      expect(onPageChange).not.toHaveBeenCalled();

      // Zoom qo'llandi: betlar kattalashib ekranga boshqa bet kirsa ham 400 ms ichida — yo'q.
      zooming = false;
      rerender(view({ zoom: 1.6 }));
      scroll();
      act(() => void vi.advanceTimersByTime(350));
      expect(onPageChange).not.toHaveBeenCalled();

      // Qulf ochilgach bir marta o'lchanadi.
      act(() => void vi.advanceTimersByTime(400));
      expect(onPageChange).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("masshtab o'zgarmasa qayta scroll qilinmaydi", async () => {
    const { rerender } = render(<VerticalView {...props({ page: 5 })} />);
    await act(async () => undefined);
    scrolled.length = 0;
    rerender(<VerticalView {...props({ page: 5, pageReserve: 120 })} />);
    await act(async () => undefined);
    expect(scrolled).toEqual([]);
  });
});
