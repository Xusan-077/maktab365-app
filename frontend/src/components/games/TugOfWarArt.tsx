"use client";

import { m } from "@/components/ui/motion";
import { ROPE_LIMIT } from "@/lib/games/rope";
import { cn } from "@/lib/utils/cn";

/** Bir qadamda guruh shuncha siljiydi (o'z kengligiga nisbatan, %). */
const STEP_PERCENT = 6;

function Kid({ x, facing, team }: { x: number; facing: 1 | -1; team: "blue" | "red" }) {
  const shirt = team === "blue" ? "var(--color-team-blue)" : "var(--color-team-red)";
  return (
    <g transform={`translate(${x} 0) scale(${facing} 1)`}>
      <ellipse cx="6" cy="172" rx="30" ry="6" fill="currentColor" opacity="0.12" />
      {/* Oyoqlar: oldinga tiralgan */}
      <path
        d="M-4 118 L14 168 M6 116 L30 166"
        stroke="var(--color-game-hair)"
        strokeWidth="9"
        strokeLinecap="round"
      />
      {/* Tana: orqaga egilgan */}
      <rect
        x="-16"
        y="62"
        width="30"
        height="60"
        rx="13"
        fill={shirt}
        transform="rotate(-20 0 118)"
      />
      {/* Qo'l arqonga */}
      <path
        d="M-6 78 L36 96"
        stroke="var(--color-game-skin)"
        strokeWidth="8"
        strokeLinecap="round"
      />
      <circle cx="-22" cy="48" r="16" fill="var(--color-game-skin)" />
      <path d="M-38 46 A16 16 0 0 1 -8 38 L-10 44 Z" fill="var(--color-game-hair)" />
    </g>
  );
}

/**
 * Arqon tortayotgan ikki juft bola (vaqtinchalik SVG illyustratsiya — keyin rasm bilan
 * almashtiriladi; `position` va sahna mantiqi `RopeGame` da). Arqon o'rtasida qizil bayroqcha;
 * butun guruh to'g'ri javob bergan tomonga spring bilan siljiydi.
 */
export function TugOfWarArt({ position, className }: { position: number; className?: string }) {
  const clamped = Math.max(-ROPE_LIMIT, Math.min(ROPE_LIMIT, position));
  return (
    <div className={cn("relative w-full overflow-hidden", className)} aria-hidden>
      {/* Markaz chizig'i joyida turadi — bayroqcha undan qancha uzoqligi ko'rinadi. */}
      <div className="border-muted/50 absolute inset-y-0 left-1/2 border-l-[3px] border-dashed" />
      <m.div
        animate={{ x: `${clamped * STEP_PERCENT}%` }}
        transition={{ type: "spring", stiffness: 160, damping: 16 }}
        data-testid="rope-art"
        data-position={clamped}
      >
        <svg viewBox="0 0 400 190" className="text-foreground block h-auto w-full">
          <path
            d="M20 96 Q200 104 380 96"
            stroke="var(--color-game-cord)"
            strokeWidth="7"
            fill="none"
            strokeLinecap="round"
          />
          <Kid x={70} facing={1} team="blue" />
          <Kid x={136} facing={1} team="blue" />
          <Kid x={264} facing={-1} team="red" />
          <Kid x={330} facing={-1} team="red" />
          {/* Bayroqcha */}
          <path d="M200 98 L200 132" stroke="var(--color-game-hair)" strokeWidth="3" />
          <path d="M200 106 L226 116 L200 126 Z" fill="var(--color-team-red)" />
        </svg>
      </m.div>
    </div>
  );
}
