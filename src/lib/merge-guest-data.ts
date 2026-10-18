import type { MaktabApi } from "@/lib/api/types";
import {
  EXERCISE_RANK,
  maxBy,
  mergeAttempts,
  READ_COMPLETED_SCROLL,
  READ_RANK,
} from "@/lib/progress/status";
import type { ExerciseStatus, Progress, ReadStatus, SaveProgressInput } from "@/types/progress";

/** Mehmon rejimida saqlangan bitta mavzu progressi. */
export interface GuestProgress {
  readStatus?: ReadStatus;
  exerciseStatus?: ExerciseStatus;
  lastBlockId?: string;
  mistakes: string[];
  solved?: string[];
  attempts?: Record<string, number>;
  /** ISO sana. */
  updatedAt: string;
}

export interface GuestData {
  progress: Record<string, GuestProgress>;
  /** Mavzu id'lari. */
  bookmarks: string[];
}

export interface GuestReadingPosition {
  scroll: number;
  lastBlockId?: string;
  updatedAt: string;
}

export interface MergeResult {
  progress: number;
  bookmarks: number;
  /** Qo'shib bo'lmagan mavzu id'lari (masalan, mavzu endi yo'q). */
  failed: string[];
}

/** Mehmonning o'qish pozitsiyalarini (reading store) progress sifatida guest ma'lumotiga qo'shadi. */
export function collectGuestData(
  guest: GuestData,
  positions: Record<string, GuestReadingPosition> = {},
): GuestData {
  const progress = { ...guest.progress };
  for (const [topicId, position] of Object.entries(positions)) {
    const current = progress[topicId] ?? { mistakes: [], updatedAt: position.updatedAt };
    progress[topicId] = {
      ...current,
      readStatus: maxBy(
        READ_RANK,
        current.readStatus,
        position.scroll >= READ_COMPLETED_SCROLL ? "completed" : "started",
      ),
      lastBlockId:
        current.updatedAt > position.updatedAt
          ? (current.lastBlockId ?? position.lastBlockId)
          : (position.lastBlockId ?? current.lastBlockId),
    };
  }
  return { progress, bookmarks: guest.bookmarks };
}

export function hasGuestData(data: GuestData): boolean {
  return Object.keys(data.progress).length > 0 || data.bookmarks.length > 0;
}

/**
 * Akkaunt progressi bilan mehmon progressini birlashtiradi: holatlar eng yuqorisi bo'yicha,
 * xatolar birlashmasi, `lastBlockId` esa yangiroq yozuvniki. Akkauntda o'zgarish kerak bo'lmasa `null`.
 */
export function mergeProgress(
  topicId: string,
  account: Progress | undefined,
  guest: GuestProgress,
): SaveProgressInput | null {
  const input: SaveProgressInput = { topicId };

  const readStatus = maxBy(READ_RANK, account?.readStatus, guest.readStatus);
  if (readStatus && readStatus !== account?.readStatus) input.readStatus = readStatus;

  const exerciseStatus = maxBy(EXERCISE_RANK, account?.exerciseStatus, guest.exerciseStatus);
  if (exerciseStatus && exerciseStatus !== account?.exerciseStatus) {
    input.exerciseStatus = exerciseStatus;
  }

  const mistakes = [...new Set([...(account?.mistakes ?? []), ...guest.mistakes])];
  if (mistakes.length !== (account?.mistakes.length ?? 0)) input.mistakes = mistakes;

  const solved = [...new Set([...(account?.solved ?? []), ...(guest.solved ?? [])])];
  if (solved.length !== (account?.solved?.length ?? 0)) input.solved = solved;

  const attempts = mergeAttempts(account?.attempts, guest.attempts);
  if (JSON.stringify(attempts) !== JSON.stringify(account?.attempts ?? {})) {
    input.attempts = attempts;
  }

  if (guest.lastBlockId) {
    const guestIsNewer = !account?.lastBlockId || guest.updatedAt > account.updatedAt;
    if (guestIsNewer && guest.lastBlockId !== account?.lastBlockId) {
      input.lastBlockId = guest.lastBlockId;
    }
  }

  return Object.keys(input).length > 1 ? input : null;
}

type MergeApi = Pick<MaktabApi, "getProgress" | "saveProgress" | "getBookmarks" | "toggleBookmark">;

/**
 * Mehmon ma'lumotini akkauntga qo'shadi. Takror chaqirilsa ham xavfsiz (idempotent): akkauntda
 * allaqachon bor narsa o'zgarmaydi, xatcho'plar qayta toggle qilinmaydi.
 */
export async function mergeGuestData(api: MergeApi, data: GuestData): Promise<MergeResult> {
  const result: MergeResult = { progress: 0, bookmarks: 0, failed: [] };

  const accountProgress = new Map(
    (await api.getProgress()).map((item) => [item.topicId, item] as const),
  );
  for (const [topicId, guest] of Object.entries(data.progress)) {
    const input = mergeProgress(topicId, accountProgress.get(topicId), guest);
    if (!input) continue;
    try {
      await api.saveProgress(input);
      result.progress++;
    } catch {
      result.failed.push(topicId);
    }
  }

  const bookmarked = new Set((await api.getBookmarks()).map((item) => item.topicId));
  for (const topicId of data.bookmarks) {
    if (bookmarked.has(topicId)) continue;
    try {
      await api.toggleBookmark(topicId);
      bookmarked.add(topicId);
      result.bookmarks++;
    } catch {
      result.failed.push(topicId);
    }
  }

  return result;
}
