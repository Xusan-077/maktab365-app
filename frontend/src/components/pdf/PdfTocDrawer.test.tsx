// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import uz from "@/lib/i18n/messages/uz.json";
import { saveSlidesProgress } from "@/lib/pdf/slides";
import type { TocChapter } from "@/lib/pdf/toc";
import { PdfTocDrawer } from "./PdfTocDrawer";

const A = "3f2b8c1e-5d4a-4c7e-9a10-0b6f1d2e3c4d";
const B = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
const t = uz.pdfBooks.slides;
const toc = uz.pdfBooks.toc;

const CHAPTERS = [
  {
    id: A,
    title: "Kirish",
    page: 1,
    slides: { page_count: 12, size_bytes: 1000 },
    children: [{ id: "c1a", title: "Maqsad", page: 10, slides: null }],
  },
  { id: B, title: "Algebra", page: 50 },
];

function setup(
  withSlides = true,
  { page = 1, resume = null as number | null, chapters = CHAPTERS as TocChapter[] } = {},
) {
  const onGo = vi.fn();
  const onOpenSlides = vi.fn();
  const onOpenChange = vi.fn();
  const onPickAnnotation = vi.fn();
  render(
    <NextIntlClientProvider locale="uz" messages={uz}>
      <PdfTocDrawer
        open
        onOpenChange={onOpenChange}
        chapters={chapters}
        page={page}
        total={240}
        resume={resume}
        onGo={onGo}
        onOpenSlides={withSlides ? onOpenSlides : undefined}
        annotations={[]}
        onPickAnnotation={onPickAnnotation}
      />
    </NextIntlClientProvider>,
  );
  return { onGo, onOpenSlides, onOpenChange };
}

beforeEach(() => {
  window.localStorage.clear();
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
  };
});
afterEach(cleanup);

describe("PdfTocDrawer: prezentatsiya", () => {
  it("belgi faqat prezentatsiyasi bor bo'limda chiqadi", () => {
    setup();
    const buttons = screen.getAllByTestId("pdf-toc-slides");

    expect(buttons).toHaveLength(1);
    expect(buttons[0].getAttribute("aria-label")).toBe("Kirish: prezentatsiyani ochish (12 slayd)");
    // Boshqa bo'limlarda hech narsa o'zgarmadi: 3 ta element (holat — ekran o'qigich uchun).
    expect(screen.getAllByTestId("pdf-toc-item").map((item) => item.textContent)).toEqual([
      `${toc.status.current}Kirish1-bet`,
      `${toc.status.unread}Maqsad10-bet`,
      `${toc.status.unread}Algebra50-bet`,
    ]);
  });

  it("prezentatsiya bo'lmasa (yoki ko'rgich ulanmagan bo'lsa) belgi yo'q", () => {
    setup(false);
    expect(screen.queryByTestId("pdf-toc-slides")).toBeNull();
  });

  it("belgi prezentatsiyani 1-slayddan ochadi va panelni yopadi", () => {
    const { onOpenSlides, onGo, onOpenChange } = setup();

    fireEvent.click(screen.getByTestId("pdf-toc-slides"));

    expect(onOpenSlides).toHaveBeenCalledWith(A, 1);
    expect(onGo).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("bo'lim nomini bossa avvalgidek kitobdagi betga o'tadi (prezentatsiya ochilmaydi)", () => {
    const { onOpenSlides, onGo } = setup();

    fireEvent.click(screen.getAllByTestId("pdf-toc-item")[0]);

    expect(onGo).toHaveBeenCalledWith(1);
    expect(onOpenSlides).not.toHaveBeenCalled();
  });

  it("oxirgi ko'rilgan slayd bo'lsa «Davom ettirish» va shu slayddan ochiladi", () => {
    saveSlidesProgress(A, 7);
    const { onOpenSlides } = setup();
    const button = screen.getByTestId("pdf-toc-slides");

    expect(button.getAttribute("title")).toBe(t.resume.replace("{slide}", "7"));
    expect(button.textContent).toContain(t.resumeShort);
    fireEvent.click(button);
    expect(onOpenSlides).toHaveBeenCalledWith(A, 7);
  });

  it("saqlangan slayd jamidan katta bo'lsa 1-slayddan boshlanadi", () => {
    saveSlidesProgress(A, 99);
    const { onOpenSlides } = setup();

    fireEvent.click(screen.getByTestId("pdf-toc-slides"));

    expect(onOpenSlides).toHaveBeenCalledWith(A, 1);
  });
});

describe("PdfTocDrawer: davom ettirish, holatlar, mashqlar", () => {
  it("saqlangan joy joriy betdan farq qilsa «Davom ettirish» shu betga o'tadi va yopiladi", () => {
    const { onGo, onOpenChange } = setup(false, { page: 1, resume: 55 });
    expect(screen.getByTestId("pdf-toc-resume").textContent).toContain("Algebra");
    fireEvent.click(screen.getByTestId("pdf-toc-resume-go"));
    expect(onGo).toHaveBeenCalledWith(55);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("joriy bet saqlangani bilan bir xil — tugmasiz «Siz shu yerdasiz»", () => {
    setup(false, { page: 12, resume: 12 });
    expect(screen.getByTestId("pdf-toc-resume").textContent).toContain(toc.hereTitle);
    expect(screen.queryByTestId("pdf-toc-resume-go")).toBeNull();
  });

  it("o'qilgan / joriy / o'qilmagan holatlar", () => {
    setup(false, { page: 12 });
    expect(screen.getAllByTestId("pdf-toc-item").map((item) => item.dataset.status)).toEqual([
      "current",
      "current",
      "unread",
    ]);
  });

  it("joriy bo'lim ichidagi mashqlar bosilsa shu betga o'tadi", () => {
    const { onGo } = setup(false, {
      page: 12,
      chapters: [
        {
          id: A,
          title: "Kirish",
          page: 1,
          children: [
            {
              id: "c1a",
              title: "Maqsad",
              page: 10,
              anchors: [{ kind: "exercise", title: "Mashqlar", page: 14 }],
            },
          ],
        },
      ],
    });
    fireEvent.click(screen.getByTestId("pdf-toc-anchor"));
    expect(onGo).toHaveBeenCalledWith(14);
  });

  it("qidiruv maydoni qisqa mundarijada ham bor; «Belgilar» yorlig'i", () => {
    setup(false);
    expect(screen.getByTestId("toc-search")).toBeTruthy();
    fireEvent.click(screen.getByTestId("reader-tab-marks"));
    expect(screen.getByText(uz.pdfBooks.annotations.empty)).toBeTruthy();
  });
});
