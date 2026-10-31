"use client";

import { useState } from "react";

const COLORS = [
  "var(--color-game-box)",
  "var(--color-game-sector-2)",
  "var(--color-team-green)",
  "var(--color-game-gold)",
  "var(--color-team-red)",
  "var(--color-team-blue)",
];

function makePieces(count: number, colors: readonly string[]) {
  return Array.from({ length: count }, (_, index) => ({
    left: Math.random() * 100,
    delay: Math.random() * 1.6,
    duration: 2.6 + Math.random() * 2.4,
    width: 8 + Math.random() * 6,
    color: colors[index % colors.length],
    round: index % 3 === 0,
  }));
}

/** Bir martalik konfetti (bezak). `prefers-reduced-motion` da ko'rinmaydi (`globals.css`). */
export function Confetti({
  count = 70,
  colors = COLORS,
}: {
  count?: number;
  /** Masalan, g'olib jamoa ranglari. */
  colors?: readonly string[];
}) {
  const [pieces] = useState(() => makePieces(count, colors));
  return (
    <div
      aria-hidden
      className="game-confetti pointer-events-none fixed inset-0 z-50 overflow-hidden"
      data-testid="confetti"
    >
      {pieces.map((piece, index) => (
        <span
          key={index}
          className="absolute top-0 block"
          style={
            {
              left: `${piece.left}%`,
              width: piece.width,
              height: piece.round ? piece.width : piece.width * 0.5,
              borderRadius: piece.round ? "999px" : "2px",
              backgroundColor: piece.color,
              "--t": `${piece.duration}s`,
              "--delay": `${piece.delay}s`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
