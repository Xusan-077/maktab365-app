import { LruCache } from "./lru";
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from "./pdfjs";

/** Bir vaqtda shuncha bet chiziladi; qolgani navbatda (ustuvorlik bo'yicha). */
const CONCURRENCY = 2;
/** Tayyor betlar keshi (taxminan 12 bet). */
const CAPACITY = 12;

interface Entry {
  page: number;
  scale: number;
  canvas: HTMLCanvasElement;
}

interface Waiter {
  resolve: (canvas: HTMLCanvasElement) => void;
  reject: (error: unknown) => void;
}

interface Job {
  key: string;
  page: number;
  scale: number;
  priority: number;
  waiters: Set<Waiter>;
  task?: RenderTask;
  cancelled: boolean;
}

export interface RenderRequest {
  promise: Promise<HTMLCanvasElement>;
  /** So'rov kerak emas: boshqa kutuvchi bo'lmasa navbatdan olinadi yoki chizish to'xtatiladi. */
  cancel: () => void;
}

/** pdf.js bekor qilish xatosi bilan bir xil nom: chaqiruvchi uni jim o'tkazadi. */
function cancelledError() {
  const error = new Error("Rendering cancelled");
  error.name = "RenderingCancelledException";
  return error;
}

const keyOf = (page: number, scale: number) => `${page}@${scale.toFixed(3)}`;

/** Canvas xotirasini darhol bo'shatadi (GC kutilmaydi). */
const release = (canvas: HTMLCanvasElement) => {
  canvas.width = 0;
  canvas.height = 0;
};

/**
 * PDF betlarini chizish navbati va LRU keshi (kitob rejimi): bir xil bet/masshtab so'rovlari
 * birlashadi, keraksiz bo'lib qolgan chizish bekor qilinadi, tayyor bet ekrandan tashqari canvas'da
 * saqlanadi (12 tagacha; chiqarilgani 0×0 qilinadi). Har chizishdan keyin `page.cleanup()`.
 */
export class PageRenderPool {
  private readonly cache = new LruCache<string, Entry>(CAPACITY, (entry) => release(entry.canvas));
  private readonly jobs = new Map<string, Job>();
  private readonly running = new Set<Job>();

  constructor(private readonly doc: PDFDocumentProxy) {}

  /** Bet `scale` (CSS × piksel zichligi) masshtabida; kichik `priority` — oldinroq. */
  request(page: number, scale: number, priority = 0): RenderRequest {
    const key = keyOf(page, scale);
    const cached = this.cache.get(key);
    if (cached) return { promise: Promise.resolve(cached.canvas), cancel: () => undefined };
    let job = this.jobs.get(key);
    if (!job) {
      job = { key, page, scale, priority, waiters: new Set(), cancelled: false };
      this.jobs.set(key, job);
    } else {
      job.priority = Math.min(job.priority, priority);
    }
    const target = job;
    let waiter!: Waiter;
    const promise = new Promise<HTMLCanvasElement>((resolve, reject) => {
      waiter = { resolve, reject };
    });
    target.waiters.add(waiter);
    this.pump();
    return {
      promise,
      cancel: () => {
        if (!target.waiters.delete(waiter)) return;
        waiter.reject(cancelledError());
        if (target.waiters.size > 0) return;
        target.cancelled = true;
        this.jobs.delete(target.key);
        target.task?.cancel();
      },
    };
  }

  /** Shu betning keshdagi eng aniq nusxasi (yangisi chizilguncha vaqtincha ko'rsatish uchun). */
  peek(page: number): HTMLCanvasElement | null {
    let best: Entry | undefined;
    this.cache.find((entry) => {
      if (entry.page === page && (!best || entry.scale > best.scale)) best = entry;
      return false;
    });
    return best?.canvas ?? null;
  }

  /**
   * Hammasini bekor qiladi va keshni bo'shatadi (unmount, hujjat almashganda). Navbat keyin ham
   * ishlatilishi mumkin (React StrictMode effektni qayta ishga tushirganda).
   */
  clear() {
    for (const job of this.jobs.values()) {
      job.cancelled = true;
      job.task?.cancel();
      for (const waiter of job.waiters) waiter.reject(cancelledError());
    }
    this.jobs.clear();
    this.cache.clear();
  }

  private pump() {
    while (this.running.size < CONCURRENCY) {
      let next: Job | undefined;
      for (const job of this.jobs.values()) {
        if (this.running.has(job)) continue;
        if (!next || job.priority < next.priority) next = job;
      }
      if (!next) return;
      this.running.add(next);
      void this.run(next);
    }
  }

  private async run(job: Job) {
    let proxy: PDFPageProxy | undefined;
    let canvas: HTMLCanvasElement | undefined;
    try {
      proxy = await this.doc.getPage(job.page);
      if (job.cancelled) return;
      const viewport = proxy.getViewport({ scale: job.scale });
      canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas is not available");
      job.task = proxy.render({ canvas, canvasContext: context, viewport });
      await job.task.promise;
      if (job.cancelled) {
        release(canvas);
        return;
      }
      this.cache.set(job.key, { page: job.page, scale: job.scale, canvas });
      for (const waiter of job.waiters) waiter.resolve(canvas);
    } catch (error) {
      if (canvas) release(canvas);
      for (const waiter of job.waiters) waiter.reject(error);
    } finally {
      this.running.delete(job);
      if (this.jobs.get(job.key) === job) this.jobs.delete(job.key);
      // Shu betning boshqa chizishi davom etmayotgan bo'lsa pdf.js resurslari bo'shatiladi.
      const busy = [...this.running].some((other) => other.page === job.page);
      if (proxy && !busy) proxy.cleanup();
      this.pump();
    }
  }
}
