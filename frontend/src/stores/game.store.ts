import { useEffect, useState } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { GameQuestion, GameTopic } from "@/lib/games/api";
import { isGameId, type GameId } from "@/lib/games/config";
import { applyAnswer, nextTurn, type TeamResult } from "@/lib/games/scoring";

export const GAME_STORAGE_KEY = "maktab365-game";

export interface GameSetup {
  game: GameId;
  topic: GameTopic;
  teamNames: string[];
  questionCount: number;
  questions: GameQuestion[];
  /** Kirgan foydalanuvchida server sessiyasi; mehmonda `null`. */
  sessionId: string | null;
}

interface GameState {
  game: GameId | null;
  topic: GameTopic | null;
  questionCount: number;
  questions: GameQuestion[];
  /** Jamoalar natijasi (nom, ball, to'g'ri javoblar, jami). */
  scores: TeamResult[];
  /** Navbatdagi jamoa indeksi. */
  turn: number;
  /** Joriy savol indeksi. */
  index: number;
  session: string | null;
  startedAt: number | null;
  finishedAt: number | null;

  start: (setup: GameSetup) => void;
  /** Navbatdagi jamoa javobi: ball qo'shiladi (navbat `next` da almashadi). */
  answer: (correct: boolean, secondsLeft: number) => void;
  /** Keyingi savol va jamoa; savollar tugasa o'yin tugaydi. */
  next: () => void;
  finish: () => void;
  reset: () => void;
}

const EMPTY = {
  game: null,
  topic: null,
  questionCount: 0,
  questions: [],
  scores: [],
  turn: 0,
  index: 0,
  session: null,
  startedAt: null,
  finishedAt: null,
} satisfies Partial<GameState>;

/**
 * O'yin holati: modal sozlaydi, o'yin va natija sahifalari o'qiydi. Sahifa yangilansa
 * `sessionStorage` dan tiklanadi (tab yopilsa yo'qoladi — boshqa tabga aralashmaydi).
 */
export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      ...EMPTY,
      start: (setup) =>
        set({
          game: setup.game,
          topic: setup.topic,
          questionCount: setup.questionCount,
          questions: setup.questions,
          scores: setup.teamNames.map((name) => ({ name, score: 0, correct: 0, total: 0 })),
          turn: 0,
          index: 0,
          session: setup.sessionId,
          startedAt: Date.now(),
          finishedAt: null,
        }),
      answer: (correct, secondsLeft) =>
        set((state) => ({ scores: applyAnswer(state.scores, state.turn, correct, secondsLeft) })),
      next: () => {
        const { index, questions, turn, scores } = get();
        if (index + 1 >= questions.length) {
          get().finish();
          return;
        }
        set({ index: index + 1, turn: nextTurn(turn, scores.length) });
      },
      finish: () => set((state) => ({ finishedAt: state.finishedAt ?? Date.now() })),
      reset: () => set({ ...EMPTY }),
    }),
    {
      name: GAME_STORAGE_KEY,
      storage: createJSONStorage(() => sessionStorage),
      partialize: ({
        game,
        topic,
        questionCount,
        questions,
        scores,
        turn,
        index,
        session,
        startedAt,
        finishedAt,
      }) => ({
        game,
        topic,
        questionCount,
        questions,
        scores,
        turn,
        index,
        session,
        startedAt,
        finishedAt,
      }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<GameState> | undefined;
        if (!saved || !isGameId(saved.game) || !saved.topic || !Array.isArray(saved.questions)) {
          return current;
        }
        return { ...current, ...saved };
      },
      // SSR'da sessionStorage yo'q: sahifa mount bo'lgach `useGameHydrated` tiklaydi.
      skipHydration: true,
    },
  ),
);

/** O'yin/natija sahifalari: `sessionStorage` dan tiklanguncha `false` (SSR va birinchi render). */
export function useGameHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => useGameStore.persist.hasHydrated());
  useEffect(() => {
    if (useGameStore.persist.hasHydrated()) return;
    const unsubscribe = useGameStore.persist.onFinishHydration(() => setHydrated(true));
    void useGameStore.persist.rehydrate();
    return unsubscribe;
  }, []);
  return hydrated;
}
