import { useTranslations } from "next-intl";

/** Bitta tortuvchi (chap tomonga qaragan holda). */
function Kid({ x, shirt }: { x: number; shirt: string }) {
  const cloth = "var(--color-game-cloth)";
  const skin = "var(--color-game-skin)";
  return (
    <g transform={`translate(${x},118)`} fill="none" strokeLinecap="round">
      <path d="M-30 32 L-8 84 M-30 32 L-62 82" stroke={cloth} strokeWidth="12" />
      <circle cx="-6" cy="88" r="7" fill="var(--color-game-boot)" />
      <circle cx="-64" cy="84" r="7" fill="var(--color-game-boot)" />
      <path d="M-30 32 L-44 -6" stroke={shirt} strokeWidth="24" />
      <path d="M-44 -4 L-2 0" stroke={shirt} strokeWidth="10" />
      <circle cx="0" cy="0" r="5" fill={skin} />
      <circle cx="-46" cy="-30" r="15" fill={skin} />
      <path d="M-62 -33 a16 14 0 0 1 32 0 z" fill={cloth} />
      <path d="M-59 -37 h26" stroke="var(--color-game-band)" strokeWidth="2" />
    </g>
  );
}

/**
 * Arqon tortish illyustratsiyasi (vaqtinchalik SVG, keyin haqiqiy rasm bilan almashtiriladi):
 * har tomonda 2 tortuvchi, o'rtada bayroqcha. Butun sahna `position` bo'yicha siljiydi.
 */
export function RopeScene({ position }: { position: number }) {
  const t = useTranslations("games.play.rope");
  return (
    <div
      className="relative w-[min(360px,90%)] transition-transform duration-[600ms] ease-[cubic-bezier(.3,1.6,.5,1)] max-[1000px]:mb-6 min-[1001px]:w-[min(420px,100%)]"
      style={{ transform: `translateX(${position * 3.6}%)` }}
      data-testid="rope-art"
      data-position={position}
    >
      <svg
        viewBox="0 0 480 220"
        role="img"
        aria-label={t("sceneLabel")}
        className="game-anim-tug block h-auto w-full"
      >
        <line
          x1="20"
          y1="208"
          x2="460"
          y2="208"
          stroke="var(--color-border)"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M20 118 L460 118"
          stroke="var(--color-game-cord)"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path
          d="M20 118 L460 118"
          stroke="var(--color-game-cord-light)"
          strokeWidth="3"
          strokeDasharray="4 9"
        />
        <Kid x={172} shirt="var(--color-team-blue)" />
        <Kid x={118} shirt="var(--color-game-kid-blue)" />
        <g transform="translate(480,0) scale(-1,1)">
          <Kid x={172} shirt="var(--color-team-red)" />
          <Kid x={118} shirt="var(--color-game-kid-red)" />
        </g>
        <circle cx="240" cy="118" r="6" fill="var(--color-game-knot)" />
        <path d="M240 122 l-9 30 l9 -9 l9 9 z" fill="var(--color-game-flag)" />
      </svg>
    </div>
  );
}
