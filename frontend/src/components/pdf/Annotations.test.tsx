// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import uz from "@/lib/i18n/messages/uz.json";
import type { Annotation } from "@/lib/pdf/annotations";
import { AnnotationDialog } from "./AnnotationDialog";
import { AnnotationLayer } from "./AnnotationLayer";
import { AnnotationsList } from "./AnnotationsListDialog";

const t = uz.pdfBooks.annotations;
const note: Annotation = {
  id: "a1",
  pdf_book_id: "b1",
  page: 4,
  color: "green",
  rects: [{ x: 0.1, y: 0.2, w: 0.3, h: 0.05 }],
  note: "Imtihonda so'raladi",
};

function intl(node: React.ReactNode) {
  return (
    <NextIntlClientProvider locale="uz" messages={uz}>
      {node}
    </NextIntlClientProvider>
  );
}

beforeEach(() => {
  // jsdom'da o'lcham va pointer capture yo'q.
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    width: 400,
    height: 600,
    right: 400,
    bottom: 600,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  HTMLElement.prototype.setPointerCapture = vi.fn();
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AnnotationLayer", () => {
  it("belgilash rejimida sudrash to'rtburchak beradi (sahifa ulushida)", () => {
    const onDraw = vi.fn();
    render(intl(<AnnotationLayer annotations={[]} drawing onDraw={onDraw} onSelect={vi.fn()} />));
    const layer = screen.getByTestId("annotation-layer");
    fireEvent.pointerDown(layer, { clientX: 40, clientY: 60, pointerId: 1 });
    fireEvent.pointerMove(layer, { clientX: 240, clientY: 120, pointerId: 1 });
    expect(screen.getByTestId("annotation-preview")).toBeTruthy();
    fireEvent.pointerUp(layer, { clientX: 240, clientY: 120, pointerId: 1 });

    expect(onDraw).toHaveBeenCalledTimes(1);
    const rect = onDraw.mock.calls[0][0];
    expect(rect.x).toBeCloseTo(0.1);
    expect(rect.y).toBeCloseTo(0.1);
    expect(rect.w).toBeCloseTo(0.5);
    expect(rect.h).toBeCloseTo(0.1);
  });

  it("tasodifiy bosish (juda kichik) belgi yaratmaydi; rejim o'chiq bo'lsa sudrab bo'lmaydi", () => {
    const onDraw = vi.fn();
    const { rerender } = render(
      intl(<AnnotationLayer annotations={[]} drawing onDraw={onDraw} onSelect={vi.fn()} />),
    );
    const layer = screen.getByTestId("annotation-layer");
    fireEvent.pointerDown(layer, { clientX: 50, clientY: 50, pointerId: 1 });
    fireEvent.pointerUp(layer, { clientX: 52, clientY: 52, pointerId: 1 });
    expect(onDraw).not.toHaveBeenCalled();

    rerender(
      intl(<AnnotationLayer annotations={[]} drawing={false} onDraw={onDraw} onSelect={vi.fn()} />),
    );
    const idle = screen.getByTestId("annotation-layer");
    fireEvent.pointerDown(idle, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerUp(idle, { clientX: 300, clientY: 300, pointerId: 1 });
    expect(onDraw).not.toHaveBeenCalled();
  });

  it("mavjud belgilar rang va eslatma bilan chiziladi va bosilganda tanlanadi", () => {
    const onSelect = vi.fn();
    render(
      intl(
        <AnnotationLayer
          annotations={[note]}
          drawing={false}
          onDraw={vi.fn()}
          onSelect={onSelect}
        />,
      ),
    );
    const mark = screen.getByTestId("annotation-mark");
    expect(mark.dataset.color).toBe("green");
    expect(mark.getAttribute("aria-label")).toContain("Imtihonda so'raladi");
    expect(mark.style.left).toBe("10%");
    fireEvent.click(mark);
    expect(onSelect).toHaveBeenCalledWith(note);
  });
});

describe("AnnotationDialog", () => {
  it("rang va eslatma tanlab saqlaydi", () => {
    const onSave = vi.fn();
    render(
      intl(
        <AnnotationDialog
          editing={false}
          initial={{ color: "yellow", note: "" }}
          onSave={onSave}
          onClose={vi.fn()}
        />,
      ),
    );
    fireEvent.click(screen.getByRole("radio", { name: t.colors.pink }));
    fireEvent.change(screen.getByTestId("annotation-note"), { target: { value: "  Formula  " } });
    fireEvent.click(screen.getByTestId("annotation-save"));
    expect(onSave).toHaveBeenCalledWith({ color: "pink", note: "Formula" });
    expect(screen.queryByTestId("annotation-delete")).toBeNull();
  });

  it("tahrirlashda o'chirish tugmasi bor; eslatma 200 belgigacha", () => {
    const onDelete = vi.fn();
    render(
      intl(
        <AnnotationDialog
          editing
          initial={{ color: "green", note: "x" }}
          onSave={vi.fn()}
          onDelete={onDelete}
          onClose={vi.fn()}
        />,
      ),
    );
    expect(screen.getByTestId("annotation-note").getAttribute("maxlength")).toBe("200");
    fireEvent.click(screen.getByTestId("annotation-delete"));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});

describe("AnnotationsList", () => {
  it("belgilar ro'yxati, bosilsa shu belgi tanlanadi; bo'sh holat", () => {
    const onPick = vi.fn();
    render(intl(<AnnotationsList items={[note]} onPick={onPick} />));
    fireEvent.click(screen.getByRole("button", { name: /4-bet/ }));
    expect(onPick).toHaveBeenCalledWith(note);
    cleanup();

    render(intl(<AnnotationsList items={[]} onPick={onPick} />));
    expect(screen.getByText(t.empty)).toBeTruthy();
  });
});
