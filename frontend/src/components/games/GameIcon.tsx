import type { ReactNode } from "react";
import { GAME_KEYS, type GameId } from "@/lib/games/config";
import { cn } from "@/lib/utils/cn";

const GLYPHS: Record<GameId, ReactNode> = {
  "sirli-quti": <path d="M3 7l9-4 9 4v10l-9 4-9-4V7zM3 7l9 4 9-4M12 11v10" />,
  "omad-charhi": (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6L5.6 18.4" />
    </>
  ),
  "arqon-tortish": <path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4" />,
};

/** O'yin belgisi (rang berilmaydi — `currentColor`). */
export function GameGlyph({
  game,
  size,
  strokeWidth = 2,
}: {
  game: GameId;
  size: number;
  strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {GLYPHS[game]}
    </svg>
  );
}

const SIZES = {
  md: { box: "size-12 rounded-[14px]", icon: 26, stroke: 2 },
  hero: { box: "size-16 rounded-[20px]", icon: 32, stroke: 2 },
  lg: { box: "size-14 rounded-[18px] sm:size-[84px] sm:rounded-[26px]", icon: 42, stroke: 1.9 },
} as const;

/** O'yinning tekis rangli ikonkasi (rang `data-game` dan). Bezak — yonidagi matn nomni aytadi. */
export function GameIcon({
  game,
  size = "md",
  float = false,
  delay = 0,
  className,
}: {
  game: GameId;
  size?: keyof typeof SIZES;
  /** Sekin suzib turadi (`prefers-reduced-motion` da o'chadi). */
  float?: boolean;
  delay?: number;
  className?: string;
}) {
  const { box, icon, stroke } = SIZES[size];
  return (
    <span
      aria-hidden
      data-game={GAME_KEYS[game]}
      style={delay ? { animationDelay: `${delay}s` } : undefined}
      className={cn(
        "inline-flex shrink-0 items-center justify-center bg-[var(--game)] text-white [&>svg]:max-sm:size-7",
        box,
        float && "game-anim-floaty",
        className,
      )}
    >
      <GameGlyph game={game} size={icon} strokeWidth={stroke} />
    </span>
  );
}
