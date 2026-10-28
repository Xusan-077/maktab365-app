"use client";

import { useEffect } from "react";
import { Gamepad2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/ui/EmptyState";
import { useSound } from "@/hooks/useSound";
import { GAME_KEYS, type GameId } from "@/lib/games/config";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { gameResultPath, ROUTES } from "@/lib/utils/routes";
import { useGameHydrated, useGameStore } from "@/stores/game.store";
import { BoxGame } from "./BoxGame";
import { RopeGame } from "./RopeGame";
import { WheelGame } from "./WheelGame";

/** Sirli quti: oxirgi quti ochilish animatsiyasi ko'rinsin, keyin natijaga. */
const RESULT_DELAY_MS: Record<GameId, number | null> = {
  "sirli-quti": 900,
  "omad-charhi": 0,
  // Arqon tortish o'z g'olib modalini ko'rsatadi ("Natijani ko'rish" tugmasi).
  "arqon-tortish": null,
};

/**
 * O'yin ekrani: holat `useGameStore` da (modal sozlaydi, sessionStorage'dan tiklanadi). Har o'yin
 * o'z sahnasi bilan: `BoxGame`, `WheelGame`, `RopeGame`. O'yin tugasa natija sahifasiga.
 */
export function GamePlayView({ topicSlug, game }: { topicSlug: string; game: GameId }) {
  const t = useTranslations("games");
  const hydrated = useGameHydrated();
  const router = useRouter();
  const sound = useSound();
  const current = useGameStore((state) => state.game);
  const topic = useGameStore((state) => state.topic);
  const questionCount = useGameStore((state) => state.questions.length);
  const startedAt = useGameStore((state) => state.startedAt);
  const finishedAt = useGameStore((state) => state.finishedAt);

  const ready = hydrated && current === game && topic?.slug === topicSlug && questionCount > 0;
  const finished = ready && finishedAt !== null;

  useEffect(() => {
    const delay = RESULT_DELAY_MS[game];
    if (!finished || delay === null) return;
    const timer = setTimeout(() => router.replace(gameResultPath(topicSlug)), delay);
    return () => clearTimeout(timer);
  }, [finished, game, router, topicSlug]);

  if (!hydrated) return <div className="min-h-dvh" aria-busy />;
  if (!ready || !topic) return <GameNotReady />;

  const title = t(`list.${GAME_KEYS[game]}.name`);
  // Yangi o'yin (masalan, "Qayta o'ynash") — sahna holati noldan.
  const key = startedAt ?? 0;
  if (game === "sirli-quti") return <BoxGame key={key} title={title} sound={sound} />;
  if (game === "omad-charhi") return <WheelGame key={key} title={title} sound={sound} />;
  return <RopeGame key={key} title={title} sound={sound} />;
}

export function GameNotReady() {
  const t = useTranslations("games.play");
  return (
    <div className="font-game flex min-h-dvh items-center justify-center p-4">
      <EmptyState
        icon={Gamepad2}
        className="w-full max-w-md rounded-[1.5rem]"
        action={
          <Link
            href={ROUTES.games}
            className="game-press bg-game-indigo inline-flex h-12 items-center rounded-[1rem] px-6 font-bold text-white"
          >
            {t("toGames")}
          </Link>
        }
      >
        {t("notReady")}
      </EmptyState>
    </div>
  );
}
