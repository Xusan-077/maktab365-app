import type { AttemptInput } from "./types";

export interface PlayOption {
  id: string;
  text: string;
}

export interface PlayQuestion {
  id: string;
  text: string;
  imageUrl: string | null;
  options: PlayOption[];
}

/** Savolga berilgan javob (`optionId: null` — vaqt tugadi). */
export interface Pick {
  questionId: string;
  optionId: string | null;
  correct: boolean;
  correctOptionId: string;
}

export interface ReviewItem {
  questionId: string;
  question: string;
  chosenText: string | null;
  correctText: string;
  correct: boolean;
}

interface PlayableSource {
  id?: string;
  text: string;
  image_url?: string | null;
  options: readonly { id?: string; text: string }[];
}

type Rng = () => number;

/** Fisher–Yates; asl massivga tegmaydi. */
export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function buildPlayQuestions(
  source: readonly PlayableSource[],
  settings: { shuffleQuestions: boolean; shuffleOptions: boolean },
  rng: Rng = Math.random,
): PlayQuestion[] {
  const questions = source.flatMap((question) => {
    if (!question.id) return [];
    const options = question.options.flatMap((o) => (o.id ? [{ id: o.id, text: o.text }] : []));
    return [
      {
        id: question.id,
        text: question.text,
        imageUrl: question.image_url ?? null,
        options: settings.shuffleOptions ? shuffle(options, rng) : options,
      },
    ];
  });
  return settings.shuffleQuestions ? shuffle(questions, rng) : questions;
}

export interface PlayState {
  index: number;
  /** `answering` — javob kutilmoqda, `revealed` — to'g'ri/noto'g'ri ko'rsatilmoqda. */
  phase: "answering" | "revealed" | "finished";
  picks: Pick[];
}

export type PlayAction = { type: "reveal"; pick: Pick } | { type: "next"; total: number };

export const INITIAL_PLAY_STATE: PlayState = { index: 0, phase: "answering", picks: [] };

export function playReducer(state: PlayState, action: PlayAction): PlayState {
  switch (action.type) {
    case "reveal":
      if (state.phase !== "answering") return state;
      return { ...state, phase: "revealed", picks: [...state.picks, action.pick] };
    case "next": {
      if (state.phase !== "revealed") return state;
      const index = state.index + 1;
      return index >= action.total
        ? { ...state, phase: "finished" }
        : { ...state, index, phase: "answering" };
    }
  }
}

export const scoreOf = (picks: readonly Pick[]) => picks.filter((p) => p.correct).length;

export function percentOf(score: number, total: number): number {
  return total > 0 ? Math.floor((score * 100) / total) : 0;
}

export function buildReview(
  questions: readonly PlayQuestion[],
  picks: readonly Pick[],
): ReviewItem[] {
  const byQuestion = new Map(picks.map((p) => [p.questionId, p]));
  return questions.flatMap((question) => {
    const pick = byQuestion.get(question.id);
    if (!pick) return [];
    const text = (id: string | null) => question.options.find((o) => o.id === id)?.text ?? null;
    return [
      {
        questionId: question.id,
        question: question.text,
        chosenText: text(pick.optionId),
        correctText: text(pick.correctOptionId) ?? "",
        correct: pick.correct,
      },
    ];
  });
}

/** Serverga ketadigan natija: javobsiz savollar ham `null` bilan yuboriladi. */
/**
 * Natija faqat o'yin haqiqatan tugaganda yuboriladi: har savolga bittadan javob (yoki vaqt tugashi)
 * qayd etilgan bo'lsa. Bo'sh yoki chala o'yin (masalan, unmount) hech qachon natija bo'lmaydi.
 */
export function canSubmitAttempt(questions: readonly PlayQuestion[], picks: readonly Pick[]) {
  if (questions.length === 0 || picks.length !== questions.length) return false;
  const known = new Set(questions.map((q) => q.id));
  const seen = new Set(picks.map((p) => p.questionId));
  return seen.size === picks.length && picks.every((p) => known.has(p.questionId));
}

export function toAttemptInput(
  questions: readonly PlayQuestion[],
  picks: readonly Pick[],
  timeSpent: number,
  attemptId?: string,
): AttemptInput {
  const byQuestion = new Map(picks.map((p) => [p.questionId, p]));
  return {
    ...(attemptId ? { attempt_id: attemptId } : {}),
    answers: questions.map((q) => ({
      question_id: q.id,
      option_id: byQuestion.get(q.id)?.optionId ?? null,
    })),
    time_spent: Math.max(0, Math.round(timeSpent)),
  };
}

/** `83` → `1:23`. */
export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
