/**
 * Progress hodisalari: UI faqat shularni yuboradi (`useProgressRecorder`), holatni esa
 * `reduce.ts` hisoblaydi. Mehmon ham, akkaunt ham bir xil hodisalardan foydalanadi.
 */
export type TopicProgressEvent =
  /** Mavzu sahifasi ochildi. */
  | { type: "topic_opened"; topicId: string }
  /** O'qish davomida joy o'zgardi (oxirgi ko'rilgan blok boshqa qurilmada davom ettirish uchun). */
  | { type: "reading_moved"; topicId: string; lastBlockId?: string }
  /** Mavzu o'qildi: oxirigacha aylantirildi (`scroll`) yoki "tugatdim" bosildi (`manual`). */
  | { type: "topic_read"; topicId: string; source: "scroll" | "manual"; lastBlockId?: string }
  /** Mashqqa javob berildi. `attempt` — shu ochilishda shu mashq bo'yicha urinish raqami (1 dan). */
  | {
      type: "exercise_answered";
      topicId: string;
      exerciseId: string;
      correct: boolean;
      attempt: number;
      /** Mavzudagi mashqlar soni (hammasi yechilganini aniqlash uchun). */
      totalExercises: number;
    };

/** Xatcho'p aniq holatga o'tkaziladi (takror yuborilsa ham natija o'zgarmaydi — oflayn navbat uchun). */
export type BookmarkEvent = { type: "bookmark_toggled"; topicId: string; bookmarked: boolean };

export type ProgressEvent = TopicProgressEvent | BookmarkEvent;

export const isBookmarkEvent = (event: ProgressEvent): event is BookmarkEvent =>
  event.type === "bookmark_toggled";
