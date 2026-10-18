"use client";

import { useId, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import type { QuadraticGraphProps } from "@/types/topic";
import { WidgetFrame } from "./WidgetFrame";
import { analyzeQuadratic, buildCurvePath, formatNumber, GRAPH } from "./quadratic-math";

const COEFFICIENTS = [
  { key: "a", min: -3, max: 3, step: 0.5 },
  { key: "b", min: -10, max: 10, step: 1 },
  { key: "c", min: -10, max: 10, step: 1 },
] as const;

const toX = (x: number) => ((x - GRAPH.xMin) / (GRAPH.xMax - GRAPH.xMin)) * GRAPH.width;
const toY = (y: number) => ((GRAPH.yMax - y) / (GRAPH.yMax - GRAPH.yMin)) * GRAPH.height;

function range(min: number, max: number, step: number) {
  const values: number[] = [];
  for (let value = Math.ceil(min / step) * step; value <= max; value += step) values.push(value);
  return values;
}

export function QuadraticGraph(initial: QuadraticGraphProps) {
  const t = useTranslations("topic.graph");
  const uid = useId();
  const [coefficients, setCoefficients] = useState<QuadraticGraphProps>(initial);
  const { a, b, c } = coefficients;
  const analysis = useMemo(() => analyzeQuadratic(a, b, c), [a, b, c]);
  const path = useMemo(() => buildCurvePath(a, b, c), [a, b, c]);
  const clipId = `${uid}-clip`;

  return (
    <WidgetFrame title={t("title")} hint={t("hint")}>
      <svg
        viewBox={`0 0 ${GRAPH.width} ${GRAPH.height}`}
        role="img"
        aria-label={`${t("figure")}: ${analysis.equation}`}
        className="border-border bg-background text-muted w-full rounded-lg border"
      >
        <defs>
          <clipPath id={clipId}>
            <rect width={GRAPH.width} height={GRAPH.height} />
          </clipPath>
        </defs>
        <g stroke="currentColor" strokeOpacity={0.15}>
          {range(GRAPH.xMin, GRAPH.xMax, 2).map((x) => (
            <line key={`x${x}`} x1={toX(x)} x2={toX(x)} y1={0} y2={GRAPH.height} />
          ))}
          {range(GRAPH.yMin, GRAPH.yMax, 2).map((y) => (
            <line key={`y${y}`} x1={0} x2={GRAPH.width} y1={toY(y)} y2={toY(y)} />
          ))}
        </g>
        <g stroke="currentColor" strokeOpacity={0.7}>
          <line x1={toX(0)} x2={toX(0)} y1={0} y2={GRAPH.height} />
          <line x1={0} x2={GRAPH.width} y1={toY(0)} y2={toY(0)} />
        </g>
        <path
          d={path}
          clipPath={`url(#${clipId})`}
          fill="none"
          strokeWidth={3}
          strokeLinejoin="round"
          className="stroke-primary-600"
        />
        {analysis.roots.map((root) => (
          <circle
            key={root}
            cx={toX(root)}
            cy={toY(0)}
            r={5}
            className="fill-accent-400 stroke-primary-800"
            strokeWidth={1.5}
          />
        ))}
      </svg>

      <div className="grid gap-4 sm:grid-cols-3">
        {COEFFICIENTS.map(({ key, min, max, step }) => (
          <div key={key} className="flex flex-col gap-1">
            <label htmlFor={`${uid}-${key}`} className="flex justify-between text-sm font-medium">
              <span>{key}</span>
              <output htmlFor={`${uid}-${key}`} className="tabular-nums">
                {formatNumber(coefficients[key])}
              </output>
            </label>
            <input
              id={`${uid}-${key}`}
              type="range"
              min={min}
              max={max}
              step={step}
              value={coefficients[key]}
              onChange={(event) =>
                setCoefficients((current) => ({ ...current, [key]: Number(event.target.value) }))
              }
              className="accent-primary-600 h-8 w-full cursor-pointer"
            />
          </div>
        ))}
      </div>

      <dl className="bg-subtle grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-lg px-4 py-3 text-sm">
        <dt className="text-muted sr-only">{t("figure")}</dt>
        <dd className="col-span-2 text-base font-medium tabular-nums">{analysis.equation}</dd>
        {analysis.degenerate ? (
          <dd className="text-accent-soft-foreground bg-accent-soft col-span-2 rounded-md px-2 py-1">
            {t("aZero")}
          </dd>
        ) : (
          <>
            <dt className="text-muted">{t("discriminant")}</dt>
            <dd className="tabular-nums">{formatNumber(analysis.discriminant)}</dd>
            <dt className="text-muted">{t("roots")}</dt>
            <dd className="tabular-nums">
              {analysis.roots.length === 0
                ? t("noRoots")
                : analysis.roots.map(formatNumber).join(";  ")}
            </dd>
            {analysis.roots.length > 0 && (
              <>
                <dt className="text-muted">{t("sum")}</dt>
                <dd className="tabular-nums">{formatNumber(analysis.rootSum)} = −b/a</dd>
                <dt className="text-muted">{t("product")}</dt>
                <dd className="tabular-nums">{formatNumber(analysis.rootProduct)} = c/a</dd>
              </>
            )}
            <dt className="text-muted">{t("vertex")}</dt>
            <dd className="tabular-nums">
              ({formatNumber(analysis.vertex.x)}; {formatNumber(analysis.vertex.y)})
            </dd>
          </>
        )}
      </dl>

      <div>
        <Button variant="ghost" size="sm" onClick={() => setCoefficients(initial)}>
          {t("reset")}
        </Button>
      </div>
    </WidgetFrame>
  );
}
