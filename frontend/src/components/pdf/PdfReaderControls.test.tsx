// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import uz from "@/lib/i18n/messages/uz.json";
import { PdfReaderControls, type PdfReaderControlsProps } from "./PdfReaderControls";

let report: ((width: number) => void) | null = null;

class FakeResizeObserver {
  constructor(private callback: ResizeObserverCallback) {}
  observe() {
    report = (width) =>
      this.callback(
        [{ contentRect: { width } } as ResizeObserverEntry],
        this as unknown as ResizeObserver,
      );
  }
  disconnect() {}
  unobserve() {}
}

const props = (): PdfReaderControlsProps => ({
  tone: "light",
  fit: "width",
  zoom: 1,
  fullscreen: false,
  fullscreenSupported: true,
  onTone: vi.fn(),
  onFit: vi.fn(),
  onZoom: vi.fn(),
  onFullscreen: vi.fn(),
  onShortcuts: vi.fn(),
  onSearch: vi.fn(),
  onDrawing: vi.fn(),
});

function setup(extra: Partial<PdfReaderControlsProps> = {}) {
  const all = { ...props(), ...extra };
  render(
    <NextIntlClientProvider locale="uz" messages={uz}>
      <PdfReaderControls {...all} overflow />
    </NextIntlClientProvider>,
  );
  return all;
}

const inline = () => screen.getByRole("group").querySelectorAll(":scope > button").length;

beforeEach(() => {
  report = null;
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("PdfReaderControls: bir qator, sig'maganlari «⋯» da", () => {
  it("joy yetarli bo'lsa hammasi qatorda, «⋯» yo'q", () => {
    setup();
    act(() => report?.(1000));
    expect(inline()).toBe(7);
    expect(screen.queryByTestId("pdf-controls-more")).toBeNull();
  });

  it("tor joyda: muhimlari (qidiruv, zoom) qoladi, qolganlari menyuda va ishlaydi", () => {
    const handlers = setup();
    act(() => report?.(200)); // 3 ta + «⋯»

    expect(inline()).toBe(3);
    expect(screen.getByTestId("pdf-find-open")).toBeTruthy();
    expect(screen.getByTestId("pdf-zoom")).toBeTruthy();
    expect(screen.getByTestId("pdf-fullscreen")).toBeTruthy();
    expect(screen.queryByTestId("pdf-shortcuts")).toBeNull();

    fireEvent.click(screen.getByTestId("pdf-controls-more"));
    const items = [...screen.getByRole("menu").querySelectorAll('[role^="menuitem"]')].map(
      (item) => item.textContent,
    );
    expect(items).toEqual([
      uz.pdfBooks.controls.highlightOn,
      uz.pdfBooks.controls.tone.replace("{tone}", uz.pdfBooks.controls.tones.light),
      uz.pdfBooks.controls.fitPage,
      uz.pdfBooks.controls.shortcuts,
    ]);
    fireEvent.click(screen.getByTestId("pdf-shortcuts"));
    expect(handlers.onShortcuts).toHaveBeenCalled();
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("zoom darajasi tugmada: 1.5×", () => {
    setup({ zoom: 1.5 });
    expect(screen.getByTestId("pdf-zoom").textContent).toBe("1.5×");
    expect(screen.getByTestId("pdf-zoom").getAttribute("aria-label")).toBe(
      uz.pdfBooks.controls.zoomLevel.replace("{level}", "1.5×"),
    );
  });
});
