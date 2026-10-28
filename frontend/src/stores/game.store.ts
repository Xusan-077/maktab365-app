import { useEffect, useState } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { GameQuestion, GameTopic } from "@/lib/games/api";
import { allOpened, makeBoxes, openBox, type BoxCell, type BoxResult } from "@/lib/games/box";
import { isGameId, type GameId } from "@/lib/games/config";
import { pullRope, ROPE_SECONDS, ropeWinner } from "@/lib/games/rope";
import {
  applyAnswer,
  applyBonus,
  nextTurn,
  POINTS_CORRECT,
  type TeamResult,
} from "@/lib/games/scoring";

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

/** Arqon tortish: `position` — arqon belgisi, `cursor` — har jamoa nechanchi savolda. */
export interface RopeState {
  position: number;
  cursor: [number, number];
  /** Umumiy taymer tugaydigan vaqt (ms) — sahifa yangilansa ham davom etadi. */
  endsAt: number;
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
  /** Omad charhi: keyingi savol indeksi. */
  index: number;
  /** Sirli quti: qutilar to'ri. */
  boxes: BoxCell[];
  /** Omad charhi: charxning joriy burilishi (gradus). */
  rotation: number;
  rope: RopeState | null;
  session: string | null;
  startedAt: number | null;
  finishedAt: number | null;

  start: (setup: GameSetup) => void;
  /** Navbatdagi jamoa javobi: ball qo'shiladi (navbat `next` da almashadi). */
  answer: (correct: boolean, points?: number) => void;
  /** Navbatdagi jamoaga savolsiz ball (Bonus/Bomba). */
  bonus: (delta: number) => void;
  /** Sirli quti: qutini natija bilan ochadi. */
  openBox: (cell: number, result: BoxResult) => void;
  /** Omad charhi: yangi burilish burchagi. */
  spin: (rotation: number) => void;
  /**
   * Navbat keyingi jamoaga. Quti: hamma quti ochilsa o'yin tugaydi. Charx: `consumed` bo'lsa
   * savol sarflangan — savollar tugasa o'yin tugaydi.
   */
  next: (consumed?: boolean) => void;
  /** Arqon tortish: jamoa javobi — to'g'ri bo'lsa arqon tortiladi, jamoaga yangi savol. */
  ropeAnswer: (team: 0 | 1, correct: boolean) => void;
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
  boxes: [],
  rotation: 0,
  rope: null,
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
          boxes: setup.game === "sirli-quti" ? makeBoxes(setup.questionCount) : [],
          rotation: 0,
          rope:
            setup.game === "arqon-tortish"
              ? { position: 0, cursor: [0, 0], endsAt: Date.now() + ROPE_SECONDS * 1000 }
              : null,
          session: setup.sessionId,
          startedAt: Date.now(),
          finishedAt: null,
        }),
      answer: (correct, points = POINTS_CORRECT) =>
        set((state) => ({ scores: applyAnswer(state.scores, state.turn, correct, points) })),
      bonus: (delta) => set((state) => ({ scores: applyBonus(state.scores, state.turn, delta) })),
      openBox: (cell, result) => set((state) => ({ boxes: openBox(state.boxes, cell, result) })),
      spin: (rotation) => set({ rotation }),
      next: (consumed = true) => {
        const { game, index, questions, turn, scores, boxes } = get();
        if (game === "sirli-quti" && allOpened(boxes)) return get().finish();
        const nextIndex = game === "omad-charhi" && consumed ? index + 1 : index;
        if (game === "omad-charhi" && nextIndex >= questions.length) {
          set({ index: nextIndex });
          return get().finish();
        }
        set({ index: nextIndex, turn: nextTurn(turn, scores.length) });
      },
      ropeAnswer: (team, correct) => {
        const { rope, finishedAt } = get();
        if (!rope || finishedAt !== null) return;
        const position = pullRope(rope.position, team, correct);
        const cursor: [number, number] = [...rope.cursor];
        cursor[team] += 1;
        set((state) => ({
          scores: applyAnswer(state.scores, team, correct),
          rope: { ...rope, position, cursor },
        }));
        if (ropeWinner(position) !== null) get().finish();
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
        boxes,
        rotation,
        rope,
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
        boxes,
        rotation,
        rope,
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
  // Serverda `sessionStorage` yo'q — persist middleware `persist` API'sini qo'shmaydi.
  const [hydrated, setHydrated] = useState(() => useGameStore.persist?.hasHydrated() ?? false);
  useEffect(() => {
    if (useGameStore.persist.hasHydrated()) return;
    const unsubscribe = useGameStore.persist.onFinishHydration(() => setHydrated(true));
    void useGameStore.persist.rehydrate();
    return unsubscribe;
  }, []);
  return hydrated;
}
