import type { MaktabApi } from "@/lib/api/types";
import { hasGuestData } from "@/lib/merge-guest-data";
import type { GuestData, MergeResult } from "@/types/progress";
import { isPermanentError } from "./queue";

/** Server har ro'yxat uchun shuncha elementni qabul qiladi (`merge-guest-data/`). */
export const MERGE_CHUNK = 500;
const BASE_DELAY_MS = 2_000;
const MAX_DELAY_MS = 60_000;
const MAX_ATTEMPTS = 6;

export type GuestMergeOutcome = "empty" | "merged" | "failed";

export interface GuestMergeOptions {
  api: Pick<MaktabApi, "mergeGuestData">;
  /** Mehmon ma'lumotini yig'adi (store'larni rehydrate qiladi). */
  load: () => Promise<GuestData>;
  /** Server qabul qildi: mehmon ma'lumotini tozalash, keshni yangilash, xabar. */
  onMerged: (result: MergeResult) => void;
  isOnline?: () => boolean;
  schedule?: (callback: () => void, delayMs: number) => unknown;
  cancel?: (handle: unknown) => void;
  baseDelayMs?: number;
  maxAttempts?: number;
}

/** Katta mehmon ma'lumotini server limitiga mos bo'laklarga bo'ladi. */
export function chunkGuestData(data: GuestData, size = MERGE_CHUNK): GuestData[] {
  const progress = Object.entries(data.progress);
  const count = Math.max(
    1,
    Math.ceil(progress.length / size),
    Math.ceil(data.bookmarks.length / size),
  );
  return Array.from({ length: count }, (_, index) => ({
    progress: Object.fromEntries(progress.slice(index * size, (index + 1) * size)),
    bookmarks: data.bookmarks.slice(index * size, (index + 1) * size),
  }));
}

/**
 * Kirgandan keyin mehmon ma'lumotini akkauntga qo'shadi. Server idempotent, shuning uchun xatoda
 * (tarmoq, 5xx) ma'lumot saqlanib qoladi va eksponensial kechikish bilan (hamda internet
 * qaytganda) qayta uriniladi; doimiy rad etilsa (4xx) keyingi kirishgacha to'xtaydi.
 */
export class GuestMerger {
  private attempts = 0;
  private timer: unknown = null;
  private running: Promise<GuestMergeOutcome> | null = null;
  private disposed = false;
  private done = false;
  private rejected = false;

  constructor(private readonly options: GuestMergeOptions) {}

  /** Bitta urinish; muvaffaqiyatsiz bo'lsa qayta urinish rejalashtiriladi. */
  start(): Promise<GuestMergeOutcome> {
    this.running ??= this.attempt().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  /** Internet qaytganda: kutayotgan urinishni darhol bajaradi. */
  retryNow(): void {
    if (this.done || this.rejected || this.disposed || this.attempts === 0) return;
    this.clearTimer();
    void this.start();
  }

  dispose(): void {
    this.disposed = true;
    this.clearTimer();
  }

  private async attempt(): Promise<GuestMergeOutcome> {
    this.clearTimer();
    const { api, load, onMerged, isOnline } = this.options;
    this.attempts++;
    try {
      const guest = await load();
      if (!hasGuestData(guest)) {
        this.done = true;
        return "empty";
      }
      if (isOnline && !isOnline()) throw new Error("offline");
      const total: MergeResult = { progress: 0, bookmarks: 0, failed: [] };
      for (const chunk of chunkGuestData(guest)) {
        const result = await api.mergeGuestData(chunk);
        total.progress += result.progress;
        total.bookmarks += result.bookmarks;
        total.failed.push(...result.failed);
      }
      this.done = true;
      if (!this.disposed) onMerged(total);
      return "merged";
    } catch (error) {
      // Mehmon ma'lumoti tegilmaydi: keyingi urinish yoki keyingi kirishda qayta yuboriladi.
      if (isPermanentError(error)) this.rejected = true;
      else this.scheduleRetry();
      return "failed";
    }
  }

  private scheduleRetry(): void {
    const {
      baseDelayMs = BASE_DELAY_MS,
      maxAttempts = MAX_ATTEMPTS,
      schedule = setTimeout,
    } = this.options;
    if (this.disposed || this.attempts >= maxAttempts) return;
    const delay = Math.min(MAX_DELAY_MS, baseDelayMs * 2 ** (this.attempts - 1));
    this.timer = schedule(() => {
      this.timer = null;
      void this.start();
    }, delay);
  }

  private clearTimer(): void {
    if (this.timer === null) return;
    (this.options.cancel ?? clearTimeout)(this.timer as ReturnType<typeof setTimeout>);
    this.timer = null;
  }
}
