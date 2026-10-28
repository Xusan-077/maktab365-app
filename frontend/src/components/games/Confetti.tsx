"use client";

import { useState } from "react";
import { m } from "@/components/ui/motion";

const COLORS = [
  "var(--color-team-blue)",
  "var(--color-team-red)",
  "var(--color-team-green)",
  "var(--color-game-indigo)",
  "var(--color-accent-400)",
  "var(--color-game-wheel-from)",
];

interface Piece {
  left: number;
  delay: number;
  duration: number;
  drift: number;
  spin: number;
  size: number;
  color: string;
  round: boolean;
}

function makePieces(count: number, colors: readonly string[]): Piece[] {
  return Array.from({ length: count }, (_, index) => ({
    left: Math.random() * 100,
    delay: Math.random() * 0.6,
    duration: 2.2 + Math.random() * 1.6,
    drift: (Math.random() - 0.5) * 160,
    spin: (Math.random() - 0.5) * 900,
    size: 8 + Math.random() * 8,
    color: colors[index % colors.length],
    round: index % 3 === 0,
  }));
}

/**
 * Bir martalik konfetti (bezak, `aria-hidden`). Faqat transform/opacity; `prefers-reduced-motion`
 * da `MotionConfig` transformlarni o'chiradi — bo'laklar shunchaki so'nadi.
 */
export function Confetti({
  count = 90,
  colors = COLORS,
}: {
  count?: number;
  /** Masalan, g'olib jamoa ranglari (`var(--color-team-blue)` …). */
  colors?: readonly string[];
}) {
  const [pieces] = useState(() => makePieces(count, colors));
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-50 overflow-hidden"
      data-testid="confetti"
    >
      {pieces.map((piece, index) => (
        <m.span
          key={index}
          className="absolute -top-6 block"
          style={{
            left: `${piece.left}%`,
            width: piece.size,
            height: piece.round ? piece.size : piece.size * 0.45,
            borderRadius: piece.round ? "999px" : "2px",
            backgroundColor: piece.color,
          }}
          initial={{ y: 0, x: 0, rotate: 0, opacity: 1 }}
          animate={{
            y: "110vh",
            x: piece.drift,
            rotate: piece.spin,
            opacity: [1, 1, 0],
            transition: { duration: piece.duration, delay: piece.delay, ease: "easeIn" },
          }}
        />
      ))}
    </div>
  );
}
