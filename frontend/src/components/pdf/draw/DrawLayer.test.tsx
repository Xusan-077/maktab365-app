// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import type { Annotation } from "@/lib/books/annotations";
import { DrawLayer, type DrawTool } from "./DrawLayer";

// jsdom'da layout yo'q: qatlam 200×300 px qutida deb olinadi.
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    left: 0,
    top: 0,
    width: 200,
    height: 300,
    right: 200,
    bottom: 300,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  HTMLElement.prototype.setPointerCapture = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function setup(tool: DrawTool, items: Annotation[] = []) {
  const onCommit = vi.fn();
  const parent = vi.fn();
  const { container } = render(
    <div onPointerDown={parent}>
      <DrawLayer
        items={items}
        tool={tool}
        color="#e5484d"
        width={0.0045}
        theme="paper"
        onCommit={onCommit}
      />
    </div>,
  );
  const layer = container.querySelector("[data-draw-layer]") as HTMLElement;
  return { layer, onCommit, parent };
}

const stroke = (
  layer: HTMLElement,
  pointerType: string,
  pointerId = 1,
  points: [number, number][] = [
    [20, 30],
    [60, 90],
    [100, 150],
  ],
) => {
  const [first, ...rest] = points;
  fireEvent.pointerDown(layer, { pointerId, pointerType, clientX: first[0], clientY: first[1] });
  for (const [x, y] of rest)
    fireEvent.pointerMove(layer, { pointerId, pointerType, clientX: x, clientY: y });
  const last = points[points.length - 1];
  fireEvent.pointerUp(layer, { pointerId, pointerType, clientX: last[0], clientY: last[1] });
};

describe("DrawLayer", () => {
  it("bitta barmoq chizadi: vektor chiziq, 0..1 koordinatalar; ota elementga o'tmaydi", () => {
    const { layer, onCommit, parent } = setup("pen");
    stroke(layer, "touch");
    expect(parent).not.toHaveBeenCalled();
    const [items] = onCommit.mock.calls[0];
    expect(items).toHaveLength(1);
    const drawing = items[0];
    expect(drawing.type).toBe("drawing");
    expect(drawing.data).toMatchObject({ tool: "pen", color: "#e5484d", width: 0.0045 });
    expect(drawing.data.points[0].slice(0, 2)).toEqual([0.1, 0.1]);
    for (const [x, y] of drawing.data.points) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(1);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(1);
    }
  });

  it("marker o'z asbobi bilan saqlanadi", () => {
    const { layer, onCommit } = setup("marker");
    stroke(layer, "mouse");
    expect(onCommit.mock.calls[0][0][0].data.tool).toBe("marker");
  });

  it("ikkinchi barmoq tegsa chizish bekor (pinch), hech narsa saqlanmaydi", () => {
    const { layer, onCommit } = setup("pen");
    fireEvent.pointerDown(layer, { pointerId: 1, pointerType: "touch", clientX: 20, clientY: 20 });
    fireEvent.pointerMove(layer, { pointerId: 1, pointerType: "touch", clientX: 40, clientY: 40 });
    fireEvent.pointerDown(layer, {
      pointerId: 2,
      pointerType: "touch",
      clientX: 150,
      clientY: 150,
    });
    fireEvent.pointerUp(layer, { pointerId: 1, pointerType: "touch", clientX: 40, clientY: 40 });
    fireEvent.pointerUp(layer, { pointerId: 2, pointerType: "touch", clientX: 150, clientY: 150 });
    expect(onCommit).not.toHaveBeenCalled();
  });

  it("stylus ishlatilgach kaft (barmoq) chizmaydi", () => {
    const { layer, onCommit } = setup("pen");
    stroke(layer, "pen", 7);
    expect(onCommit).toHaveBeenCalledTimes(1);
    stroke(layer, "touch", 8);
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it("o'chirgich tegilgan chiziqni olib tashlaydi", () => {
    const line: Annotation = {
      id: "a",
      type: "drawing",
      data: {
        tool: "pen",
        color: "ink",
        width: 0.004,
        points: [
          [0.1, 0.1, 0.5],
          [0.5, 0.5, 0.5],
        ],
      },
    };
    const { layer, onCommit } = setup("eraser", [line]);
    stroke(layer, "mouse", 1, [
      [60, 90],
      [61, 91],
    ]);
    expect(onCommit).toHaveBeenCalledWith([]);
  });

  it("rejim o'chiq — hodisa olmaydi", () => {
    const { layer, onCommit, parent } = setup("none");
    expect(layer.className).toContain("pointer-events-none");
    stroke(layer, "touch");
    expect(onCommit).not.toHaveBeenCalled();
    expect(parent).toHaveBeenCalled();
  });
});
