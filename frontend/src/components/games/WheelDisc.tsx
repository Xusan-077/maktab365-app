"use client";

import type { Ref } from "react";
import { useTranslations } from "next-intl";
import {
  sectorAngle,
  WHEEL_SECTORS,
  WHEEL_SPIN_EASE,
  WHEEL_SPIN_SECONDS,
  type WheelSector,
} from "@/lib/games/wheel";
import { cn } from "@/lib/utils/cn";

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
 * Charx: `conic-gradient` keskin chegarali 8 sektor (o'tish yo'q), oq halqa va pinlar, tepada
 * ko'rsatkich, markazda "AYLANTIRISH". Burilish `rotation` — 4 s, sekinlashib to'xtaydi.
 */
export function WheelDisc({
  rotation,
  spinning,
  canSpin,
  pointerRef,
  onSpin,
}: {
  rotation: number;
  spinning: boolean;
  canSpin: boolean;
  pointerRef: Ref<HTMLDivElement>;
  onSpin: () => void;
}) {
  const t = useTranslations("games.play.wheel");
  const label = useSectorLabel();
  const size = sectorAngle(WHEEL_SECTORS.length);

  return (
    <div
      className="relative mt-10 aspect-square w-[min(520px,100%)]"
      data-testid="wheel"
      data-rotation={rotation}
    >
      <div
        ref={pointerRef}
        aria-hidden
        className="border-t-game-boot absolute -top-10 left-1/2 z-[3] h-0 w-0 -translate-x-1/2 border-x-[24px] border-t-[52px] border-x-transparent drop-shadow-[0_3px_0_rgb(255_255_255/0.9)]"
      />
      <div
        aria-hidden
        className="absolute inset-0 rounded-full border-[12px] border-white shadow-[0_0_0_2px_var(--color-border),0_8px_0_var(--color-border)]"
      />
      <div
        aria-hidden
        className="game-wheel-disc absolute inset-3 rounded-full"
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: spinning
            ? `transform ${WHEEL_SPIN_SECONDS}s cubic-bezier(${WHEEL_SPIN_EASE.join(",")})`
            : undefined,
        }}
      >
        {WHEEL_SECTORS.map((sector, index) => (
          <div
            key={index}
            className="absolute inset-0"
            style={{ transform: `rotate(${index * size + size / 2}deg)` }}
          >
            <span className="absolute top-[13%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-base font-extrabold text-white min-[601px]:text-2xl">
              {label(sector)}
            </span>
          </div>
        ))}
        {WHEEL_SECTORS.map((_, index) => (
          <div
            key={index}
            className="absolute inset-0"
            style={{ transform: `rotate(${index * size}deg)` }}
          >
            <span className="absolute top-px left-1/2 -ml-[7px] size-3.5 rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.3)]" />
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={onSpin}
        disabled={!canSpin}
        aria-label={t("spinLabel")}
        data-testid="wheel-spin"
        className={cn(
          "absolute top-1/2 left-1/2 z-[2] -mt-[60px] -ml-[60px] size-[120px] rounded-full border-8 border-white bg-[var(--game)] text-sm font-extrabold text-white uppercase shadow-[0_6px_0_var(--game-deep)]",
          "focus-visible:ring-game-gold focus-visible:ring-4 focus-visible:outline-none",
          canSpin ? "game-anim-pulse-ring" : "cursor-default opacity-75",
        )}
      >
        {t("spin")}
      </button>
    </div>
  );
}
