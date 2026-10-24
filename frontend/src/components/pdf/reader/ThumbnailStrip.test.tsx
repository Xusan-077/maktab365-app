// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import uz from "@/lib/i18n/messages/uz.json";
import type { PDFDocumentProxy } from "@/lib/pdf/pdfjs";
import { ThumbnailStrip } from "./ThumbnailStrip";

/** Hamma kuzatilgan element darhol "ko'rindi" deb hisoblanadi. */
class InstantIntersectionObserver {
  constructor(private callback: IntersectionObserverCallback) {}
  observe(target: Element) {
    this.callback(
      [{ isIntersecting: true, target } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
  unobserve() {}
  disconnect() {}
}

function fakeDoc(failing: number[]) {
  return {
    numPages: 4,
    getPage: async (pageNumber: number) => {
      if (failing.includes(pageNumber)) throw new Error("broken page");
      return {
        getViewport: () => ({ width: 120, height: 170 }),
        render: () => ({ promise: Promise.resolve() }),
      };
    },
  } as unknown as PDFDocumentProxy;
}

beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", InstantIntersectionObserver);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    {} as CanvasRenderingContext2D,
  );
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function toBlob(callback) {
    callback(new Blob(["x"]));
  });
  let id = 0;
  URL.createObjectURL = vi.fn(() => `blob:thumb-${(id += 1)}`);
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function setup(failing: number[] = [], onGo = vi.fn()) {
  render(
    <NextIntlClientProvider locale="uz" messages={uz}>
      <ThumbnailStrip doc={fakeDoc(failing)} page={2} total={4} onGo={onGo} />
    </NextIntlClientProvider>,
  );
  return onGo;
}

describe("ThumbnailStrip", () => {
  it("ko'ringan betlar rasm bo'lib chiziladi; joriy bet belgilangan", async () => {
    setup();
    await waitFor(() => expect(document.querySelectorAll("img")).toHaveLength(4));
    const thumbs = screen.getAllByTestId("pdf-thumb");
    expect(thumbs[1].getAttribute("aria-current")).toBe("page");
    expect(document.querySelectorAll("canvas")).toHaveLength(0); // DOM'da canvas qolmaydi
  });

  it("bitta thumbnail xatosi panelni buzmaydi: o'rnida faqat bet raqami", async () => {
    setup([3]);
    await waitFor(() => expect(document.querySelectorAll("img")).toHaveLength(3));
    const broken = screen.getAllByTestId("pdf-thumb")[2];
    expect(broken.querySelector("img")).toBeNull();
    expect(broken.textContent).toBe("3");
  });

  it("bosilsa o'sha betga o'tadi", () => {
    const onGo = setup();
    fireEvent.click(
      screen.getByRole("button", { name: uz.pdfBooks.reader.thumb.replace("{page}", "4") }),
    );
    expect(onGo).toHaveBeenCalledWith(4);
  });

  it("unmount'da blob URL'lar bo'shatiladi", async () => {
    setup();
    await waitFor(() => expect(document.querySelectorAll("img")).toHaveLength(4));
    cleanup();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(4);
  });
});
