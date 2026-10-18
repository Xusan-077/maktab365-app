"use client";

import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import type { GeometryPointsProps } from "@/types/topic";
import { WidgetFrame } from "./WidgetFrame";
import { analyzeTriangle, clampToGrid, GRID_SIZE, type Point } from "./geometry-math";

const PAD = 1;
const VIEW = GRID_SIZE + PAD * 2;
const ARROW_STEP: Record<string, Point> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: 1 },
  ArrowDown: { x: 0, y: -1 },
};

// SVG'da y pastga o'sadi, matematikada yuqoriga: shuning uchun aylantiramiz.
const toSvgX = (x: number) => x + PAD;
const toSvgY = (y: number) => GRID_SIZE - y + PAD;

const format = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(2));

export function GeometryPoints({ points: initial }: GeometryPointsProps) {
  const t = useTranslations("topic.geometryPoints");
  const svgRef = useRef<SVGSVGElement>(null);
  const [points, setPoints] = useState<Point[]>(() => initial.map(({ x, y }) => ({ x, y })));
  const [dragging, setDragging] = useState<number | null>(null);
  const labels = initial.map((point) => point.label);

  const analysis = useMemo(() => analyzeTriangle(points as [Point, Point, Point]), [points]);

  const moveTo = (index: number, next: Point) =>
    setPoints((current) =>
      current.map((point, i) =>
        i === index ? { x: clampToGrid(next.x), y: clampToGrid(next.y) } : point,
      ),
    );

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (dragging === null || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const unit = rect.width / VIEW;
    moveTo(dragging, {
      x: (event.clientX - rect.left) / unit - PAD,
      y: GRID_SIZE + PAD - (event.clientY - rect.top) / unit,
    });
  };

  const onKeyDown = (index: number, event: KeyboardEvent) => {
    const step = ARROW_STEP[event.key];
    if (!step) return;
    event.preventDefault();
    moveTo(index, { x: points[index].x + step.x, y: points[index].y + step.y });
  };

  const sides = [0, 1, 2].map((i) => ({
    name: `${labels[i]}${labels[(i + 1) % 3]}`,
    length: analysis.lengths[i],
    square: analysis.squares[i],
  }));
  const polygon = points.map((p) => `${toSvgX(p.x)},${toSvgY(p.y)}`).join(" ");
  const description = [
    t(`angle.${analysis.angleKind}`),
    analysis.sideKind && t(`side.${analysis.sideKind}`),
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <WidgetFrame title={t("title")} hint={t("hint")}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        role="group"
        aria-label={t("figure")}
        className="border-border bg-background text-muted w-full max-w-md touch-none rounded-lg border select-none"
        onPointerMove={onPointerMove}
        onPointerUp={() => setDragging(null)}
        onPointerCancel={() => setDragging(null)}
      >
        <g stroke="currentColor" strokeOpacity={0.15} strokeWidth={0.04}>
          {Array.from({ length: GRID_SIZE + 1 }, (_, i) => (
            <g key={i}>
              <line x1={toSvgX(i)} x2={toSvgX(i)} y1={toSvgY(0)} y2={toSvgY(GRID_SIZE)} />
              <line x1={toSvgX(0)} x2={toSvgX(GRID_SIZE)} y1={toSvgY(i)} y2={toSvgY(i)} />
            </g>
          ))}
        </g>
        <polygon
          points={polygon}
          strokeWidth={0.1}
          strokeLinejoin="round"
          className="fill-primary-600/15 stroke-primary-600"
        />
        {points.map((point, index) => (
          <g key={index}>
            <circle
              cx={toSvgX(point.x)}
              cy={toSvgY(point.y)}
              r={0.45}
              tabIndex={0}
              role="img"
              aria-label={t("point", { label: labels[index], x: point.x, y: point.y })}
              className="fill-accent-400 stroke-primary-800 cursor-grab active:cursor-grabbing"
              strokeWidth={0.1}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                setDragging(index);
              }}
              onKeyDown={(event) => onKeyDown(index, event)}
            />
            <text
              x={toSvgX(point.x) + 0.6}
              y={toSvgY(point.y) - 0.6}
              fontSize={0.7}
              fontWeight={600}
              className="fill-foreground pointer-events-none"
            >
              {labels[index]}
            </text>
          </g>
        ))}
      </svg>

      <div role="status" aria-live="polite" className="flex flex-col gap-3">
        <p className="font-semibold">{description}</p>
        <ul className="grid gap-1 text-base sm:grid-cols-3">
          {sides.map((side) => (
            <li key={side.name}>
              <span className="font-medium">{side.name}</span> = {format(side.length)}{" "}
              <span className="text-muted text-sm">
                ({side.name}² = {side.square})
              </span>
            </li>
          ))}
        </ul>
        {analysis.pythagoras && (
          <p className="bg-success-soft text-success-soft-foreground rounded-lg px-4 py-3">
            {t("pythagoras", {
              a: analysis.pythagoras.legs[0],
              b: analysis.pythagoras.legs[1],
              c: analysis.pythagoras.hypotenuse,
            })}
          </p>
        )}
      </div>

      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setPoints(initial.map(({ x, y }) => ({ x, y })))}
        >
          {t("reset")}
        </Button>
      </div>
    </WidgetFrame>
  );
}
