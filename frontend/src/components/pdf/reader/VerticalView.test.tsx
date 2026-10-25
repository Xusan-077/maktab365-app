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
    live: null,
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

  it("masshtab o'zgarmasa qayta scroll qilinmaydi", async () => {
    const { rerender } = render(<VerticalView {...props({ page: 5 })} />);
    await act(async () => undefined);
    scrolled.length = 0;
    rerender(<VerticalView {...props({ page: 5, pageReserve: 120 })} />);
    await act(async () => undefined);
    expect(scrolled).toEqual([]);
  });
});
