import type { QueryClient } from "@tanstack/react-query";
import { apiQueries } from "@/lib/api/queries";
import { queryKeys } from "@/lib/api/query-keys";
import type { Bookmark, Progress } from "@/types/progress";
import { getSyncQueue } from "./engine";
import { isBookmarkEvent, type ProgressEvent } from "./events";
import { overlayProgress } from "./queue";
import { applyToProgress, progressFromInput, toSaveInput } from "./reduce";

/** Hodisalar ketma-ket qo'llanadi (har biri oldingisining natijasidan boshlaydi). */
let chain: Promise<void> = Promise.resolve();

function upsert(list: Progress[] | undefined, next: Progress): Progress[] {
  const rest = (list ?? []).filter((item) => item.topicId !== next.topicId);
  return [...rest, next];
}

/**
 * Akkaunt uchun hodisani yozadi: avval TanStack Query keshiga (optimistic), keyin oflayn navbatga.
 * Serverga yuborish va qayta urinish navbat vazifasi — UI kutmaydi.
 */
export function recordForAccount(
  queryClient: QueryClient,
  userId: string,
  event: ProgressEvent,
): Promise<void> {
  chain = chain
    .then(() => apply(queryClient, userId, event))
    .catch(() => {
      // bitta hodisadagi xato keyingilarni to'xtatmasin
    });
  return chain;
}

async function apply(queryClient: QueryClient, userId: string, event: ProgressEvent) {
  const queue = getSyncQueue(userId, queryClient);

  if (isBookmarkEvent(event)) {
    queryClient.setQueryData<Bookmark[]>(queryKeys.bookmarks(), (old = []) => {
      const rest = old.filter((item) => item.topicId !== event.topicId);
      return event.bookmarked
        ? [
            ...rest,
            {
              id: `pending-${event.topicId}`,
              userId,
              topicId: event.topicId,
              createdAt: new Date().toISOString(),
            },
          ]
        : rest;
    });
    queue.enqueue({ kind: "bookmark", topicId: event.topicId, bookmarked: event.bookmarked });
    return;
  }

  // Mavjud holat: kesh (kerak bo'lsa yuklanadi) + hali yuborilmagan yozuvlar. Yuklab bo'lmasa
  // (oflayn) bo'sh holatdan boshlanadi; server holatlarni pastga tushirmaydi.
  const cached = await queryClient
    .ensureQueryData(apiQueries.progress())
    .catch(() => [] as Progress[]);
  const base = overlayProgress(cached, queue.pending, (input, existing) =>
    progressFromInput(input, existing, userId),
  );
  const existing = base.find((item) => item.topicId === event.topicId);
  const next = applyToProgress(existing, event, { userId, now: new Date() });
  if (!next) return;

  queryClient.setQueryData<Progress[]>(queryKeys.progress(), (old) => upsert(old ?? cached, next));
  queue.enqueue({ kind: "progress", topicId: next.topicId, input: toSaveInput(next) });
}
