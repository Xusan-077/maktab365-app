import {
  EXERCISE_RANK,
  maxBy,
  mergeAttempts,
  READ_COMPLETED_SCROLL,
  READ_RANK,
} from "@/lib/progress/status";
import type {
  GuestData,
  GuestProgress,
  MergeResult,
  Progress,
  SaveProgressInput,
} from "@/types/progress";

export type { GuestData, GuestProgress, MergeResult };

export interface GuestReadingPosition {
  scroll: number;
  lastBlockId?: string;
  updatedAt: string;
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

/**
 * Akkauntda yo'q xatcho'plar (mavzu id'lari): birlashma, o'chirish yo'q. Server ham shunday
 * qo'shadi (`merge-guest-data/`); xatcho'p qayta toggle qilinmaydi.
 */
export function mergeBookmarks(account: readonly string[], guest: readonly string[]): string[] {
  const have = new Set(account);
  return [...new Set(guest)].filter((topicId) => !have.has(topicId));
}
