"use client";

import { useTranslations } from "next-intl";
import { m } from "@/components/ui/motion";
import {
  sectorAngle,
  WHEEL_SECTORS,
  WHEEL_SPIN_EASE,
  WHEEL_SPIN_SECONDS,
  type WheelSector,
} from "@/lib/games/wheel";
import { cn } from "@/lib/utils/cn";

const SIZE = 520;
const CENTER = SIZE / 2;
const RADIUS = 246;
const QUESTION_FILLS = [
  "var(--color-game-wheel-from)",
  "var(--color-game-wheel-to)",
  "var(--color-game-indigo)",
];

const point = (degrees: number, radius: number) => {
  const radians = ((degrees - 90) * Math.PI) / 180;
  return [CENTER + radius * Math.cos(radians), CENTER + radius * Math.sin(radians)] as const;
};

function sectorFill(sector: WheelSector, index: number) {
  if (sector.kind === "double") return "var(--color-game-amber)";
  if (sector.kind === "bonus") return "var(--color-team-green-deep)";
  return QUESTION_FILLS[index % QUESTION_FILLS.length];
}

/** Sektor yozuvi: "1"…"6", "×2", "Bonus". */
export function useSectorLabel() {
  const t = useTranslations("games.play.wheel");
  return (sector: WheelSector) =>
    sector.kind === "question"
      ? String(sector.label)
      : sector.kind === "double"
        ? t("double")
        : t("bonus");
}

/**
 * Charx (SVG, 520px gacha): 8 sektor, oq chegara va pinlar, tepada ko'rsatkich, markazda
 * pulslab turadigan "AYLANTIRISH" tugmasi. Burilish `rotation` (gradus) — 4 s, sekinlashib to'xtaydi.
 */
export function WheelDisc({
  rotation,
  spinning,
  reduced,
  canSpin,
  onSpin,
}: {
  rotation: number;
  spinning: boolean;
  reduced: boolean;
  canSpin: boolean;
  onSpin: () => void;
}) {
  const t = useTranslations("games.play.wheel");
  const label = useSectorLabel();
  const size = sectorAngle(WHEEL_SECTORS.length);

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[520px]" data-testid="wheel">
      {/* Ko'rsatkich */}
      <svg
        aria-hidden
        viewBox="0 0 40 48"
        className="text-foreground absolute top-0 left-1/2 z-10 h-[9%] -translate-x-1/2 -translate-y-[30%] drop-shadow-[0_3px_3px_rgb(0_0_0/0.3)]"
      >
        <path d="M4 4 H36 L20 44 Z" fill="currentColor" stroke="white" strokeWidth="3" />
      </svg>
      <m.div
        className="h-full w-full rounded-full shadow-[0_24px_60px_-24px_var(--game-deep)]"
        initial={{ rotate: rotation }}
        animate={{ rotate: rotation }}
        transition={{
          duration: spinning && !reduced ? WHEEL_SPIN_SECONDS : 0,
          ease: WHEEL_SPIN_EASE,
        }}
        data-rotation={rotation}
      >
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-full w-full" aria-hidden>
          <circle cx={CENTER} cy={CENTER} r={RADIUS + 10} fill="white" />
          {WHEEL_SECTORS.map((sector, index) => {
            const start = index * size;
            const [x1, y1] = point(start, RADIUS);
            const [x2, y2] = point(start + size, RADIUS);
            const [lx, ly] = point(start + size / 2, RADIUS * 0.66);
            const text = label(sector);
            return (
              <g key={index}>
                <path
                  d={`M${CENTER} ${CENTER} L${x1} ${y1} A${RADIUS} ${RADIUS} 0 0 1 ${x2} ${y2} Z`}
                  fill={sectorFill(sector, index)}
                  stroke="white"
                  strokeWidth={4}
                />
                <text
                  x={lx}
                  y={ly}
                  fill="white"
                  textAnchor="middle"
                  dominantBaseline="central"
                  transform={`rotate(${-rotation} ${lx} ${ly})`}
                  className="font-game"
                  fontWeight={800}
                  fontSize={text.length > 2 ? 34 : 62}
                >
                  {text}
                </text>
              </g>
            );
          })}
          {WHEEL_SECTORS.map((_, index) => {
            const [px, py] = point(index * size, RADIUS + 1);
            return (
              <circle
                key={index}
                cx={px}
                cy={py}
                r={7}
                fill="white"
                stroke="rgb(0 0 0 / 0.15)"
                strokeWidth={2}
              />
            );
          })}
        </svg>
      </m.div>
      <button
        type="button"
        onClick={onSpin}
        disabled={!canSpin}
        aria-label={t("spinLabel")}
        data-testid="wheel-spin"
        className={cn(
          "absolute top-1/2 left-1/2 flex aspect-square w-[27%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[5px] border-white bg-[linear-gradient(135deg,var(--game-from),var(--game-to))] p-1 text-center text-[clamp(0.6rem,0.3rem+0.9vw,1rem)] leading-tight font-extrabold tracking-wide text-white uppercase shadow-[0_6px_0_var(--game-deep),0_14px_30px_-10px_var(--game-deep)]",
          "focus-visible:ring-game-sun focus-visible:ring-4 focus-visible:outline-none disabled:cursor-default",
          canSpin && "game-pulse",
        )}
      >
        {t("spin")}
      </button>
    </div>
  );
}
