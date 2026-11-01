/**
 * Bir vaqtda ishlaydigan pdf.js chizishlari chegarasi (pool'siz yo'l — uzluksiz rejim): zoom
 * qo'llanganda 5 ta katta bet birdaniga chizilib asosiy oqimni qotirmasin. Ustuvorlik kichigi
 * oldinroq (joriy bet 0, atrofdagilar 1+). Kerak bo'lmay qolgan so'rov `cancel` bilan navbatdan
 * olinadi (eskirgan zoom'ning chizishi kutib turmaydi).
 */

export interface RenderSlot {
  /** Navbat kelganda hal bo'ladi; `cancel` dan keyin hech qachon hal bo'lmaydi. */
  ready: Promise<void>;
  /** Chizish tugadi yoki kerak emas: o'rin bo'shaydi / navbatdan olinadi. Takror chaqirish xavfsiz. */
  release: () => void;
}

interface Waiting {
  priority: number;
  order: number;
  start: () => void;
}

export class RenderLimiter {
  private running = 0;
  private order = 0;
  private readonly queue: Waiting[] = [];

  constructor(private readonly concurrency = 2) {}

  acquire(priority = 0): RenderSlot {
    let state: "waiting" | "running" | "done" = "waiting";
    let resolve!: () => void;
    const ready = new Promise<void>((done) => {
      resolve = done;
    });
    const entry: Waiting = {
      priority,
      order: this.order++,
      start: () => {
        state = "running";
        this.running += 1;
        resolve();
      },
    };
    this.queue.push(entry);
    this.pump();
    return {
      ready,
      release: () => {
        if (state === "done") return;
        if (state === "running") {
          this.running -= 1;
        } else {
          const index = this.queue.indexOf(entry);
          if (index >= 0) this.queue.splice(index, 1);
        }
        state = "done";
        this.pump();
      },
    };
  }

  /** Navbatdagi (hali boshlanmagan) so'rovlar soni — testlar uchun. */
  get pending(): number {
    return this.queue.length;
  }

  private pump() {
    while (this.running < this.concurrency && this.queue.length > 0) {
      let best = 0;
      for (let index = 1; index < this.queue.length; index += 1) {
        const item = this.queue[index];
        const top = this.queue[best];
        if (
          item.priority < top.priority ||
          (item.priority === top.priority && item.order < top.order)
        ) {
          best = index;
        }
      }
      const [next] = this.queue.splice(best, 1);
      next.start();
    }
  }
}

/** Umumiy navbat (bir vaqtda 2 ta bet). */
export const pageRenderLimiter = new RenderLimiter(2);
