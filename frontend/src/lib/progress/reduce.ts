import type { Progress, SaveProgressInput } from "@/types/progress";
import type { TopicProgressEvent } from "./events";
import { EXERCISE_RANK, maxBy, READ_RANK } from "./status";

/** Bitta mavzu holati (serverga yuboriladigan qism). */
export type TopicState = Pick<Progress, "readStatus" | "exerciseStatus" | "mistakes"> &
  Partial<Pick<Progress, "lastBlockId" | "solved" | "attempts">>;

export const EMPTY_TOPIC_STATE: TopicState = {
  readStatus: "none",
  exerciseStatus: "none",
  mistakes: [],
};

const sameState = (a: TopicState, b: TopicState) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Hodisani mavzu holatiga qo'llaydi (sof funksiya). Holat o'zgarmasa `null` qaytaradi — shunda
 * keraksiz yozuv (va tarmoq so'rovi) yuborilmaydi.
 *
 * Qoidalar:
 * - `readStatus` va `exerciseStatus` alohida va pastga tushmaydi;
 * - xato javob mashqni `mistakes[]` ga qo'shadi; mashq ochilishdagi *birinchi urinishda* to'g'ri
 *   yechilsa, `mistakes[]` dan chiqadi (xato qilib keyin to'g'rilash xatoni o'chirmaydi);
 * - mashqlar tugagan: barcha mashq kamida bir marta to'g'ri yechilgan.
 */
export function reduceTopic(
  state: TopicState = EMPTY_TOPIC_STATE,
  event: TopicProgressEvent,
): TopicState | null {
  let next: TopicState;

  switch (event.type) {
    case "topic_opened":
      next = { ...state, readStatus: maxBy(READ_RANK, state.readStatus, "started") ?? "started" };
      break;
    case "reading_moved":
      next = {
        ...state,
        readStatus: maxBy(READ_RANK, state.readStatus, "started") ?? "started",
        lastBlockId: event.lastBlockId ?? state.lastBlockId,
      };
      break;
    case "topic_read":
      next = {
        ...state,
        readStatus: "completed",
        lastBlockId: event.lastBlockId ?? state.lastBlockId,
      };
      break;
    case "exercise_answered": {
      const solved = new Set(state.solved);
      let mistakes = state.mistakes;
      if (event.correct) {
        solved.add(event.exerciseId);
        if (event.attempt === 1) mistakes = mistakes.filter((id) => id !== event.exerciseId);
      } else if (!mistakes.includes(event.exerciseId)) {
        mistakes = [...mistakes, event.exerciseId];
      }
      const reached =
        event.totalExercises > 0 && solved.size >= event.totalExercises
          ? "completed"
          : "in_progress";
      next = {
        ...state,
        exerciseStatus: maxBy(EXERCISE_RANK, state.exerciseStatus, reached) ?? reached,
        mistakes,
        solved: [...solved],
        attempts: {
          ...state.attempts,
          [event.exerciseId]: (state.attempts?.[event.exerciseId] ?? 0) + 1,
        },
      };
      break;
    }
  }

  return sameState(state, next) ? null : next;
}

/** Hodisani to'liq `Progress` yozuviga qo'llaydi; o'zgarish bo'lmasa `null`. */
export function applyToProgress(
  existing: Progress | undefined,
  event: TopicProgressEvent,
  { userId, now }: { userId: string; now: Date },
): Progress | null {
  const next = reduceTopic(existing && toTopicState(existing), event);
  if (!next) return null;
  return { ...next, userId, topicId: event.topicId, updatedAt: now.toISOString() };
}

/** `Progress` yozuvidan faqat holat maydonlarini oladi. */
export function toTopicState(progress: Progress): TopicState {
  const { readStatus, exerciseStatus, mistakes, lastBlockId, solved, attempts } = progress;
  return { readStatus, exerciseStatus, mistakes, lastBlockId, solved, attempts };
}

/** Serverga yuboriladigan to'liq holat (delta emas): takror yuborish xavfsiz. */
export function toSaveInput(progress: Progress): SaveProgressInput {
  return { topicId: progress.topicId, ...toTopicState(progress) };
}

/** Yuborilmagan yozuvni ko'rsatish uchun `Progress` ko'rinishiga keltiradi. */
export function progressFromInput(
  input: SaveProgressInput,
  existing: Progress | undefined,
  userId: string,
): Progress {
  return {
    userId: existing?.userId ?? userId,
    topicId: input.topicId,
    readStatus: input.readStatus ?? existing?.readStatus ?? "none",
    exerciseStatus: input.exerciseStatus ?? existing?.exerciseStatus ?? "none",
    lastBlockId: input.lastBlockId ?? existing?.lastBlockId,
    mistakes: input.mistakes ?? existing?.mistakes ?? [],
    solved: input.solved ?? existing?.solved,
    attempts: input.attempts ?? existing?.attempts,
    updatedAt: existing?.updatedAt ?? new Date().toISOString(),
  };
}
