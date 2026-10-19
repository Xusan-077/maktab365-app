export type ReadStatus = "none" | "started" | "completed";
export type ExerciseStatus = "none" | "in_progress" | "completed";

export type Progress = {
  userId: string;
  topicId: string;
  readStatus: ReadStatus;
  exerciseStatus: ExerciseStatus;
  /** Oxirgi ko'rilgan blok (davom ettirish uchun). */
  lastBlockId?: string;
  /** ISO sana. */
  updatedAt: string;
  /** Xato qilingan mashq bloklari id'lari: "Takrorlash kerak" shundan hisoblanadi. */
  mistakes: string[];
  /** Kamida bir marta to'g'ri bajarilgan mashq id'lari (mashqlar tugaganini aniqlaydi). */
  solved?: string[];
  /** Mashq id'si bo'yicha jami urinishlar soni. */
  attempts?: Record<string, number>;
};

export type ProgressFilters = {
  topicId?: string;
  bookId?: string;
};

export type SaveProgressInput = {
  topicId: string;
  readStatus?: ReadStatus;
  exerciseStatus?: ExerciseStatus;
  lastBlockId?: string;
  mistakes?: string[];
  solved?: string[];
  attempts?: Record<string, number>;
};

export type Bookmark = {
  id: string;
  userId: string;
  topicId: string;
  /** ISO sana. */
  createdAt: string;
};

export type ToggleBookmarkResult = {
  bookmarked: boolean;
  bookmark: Bookmark | null;
};

/** O'qituvchi saqlagan kitob. */
export type BookBookmark = {
  id: string;
  userId: string;
  bookId: string;
  /** ISO sana. */
  createdAt: string;
};

export type ToggleBookBookmarkResult = {
  bookmarked: boolean;
  bookmark: BookBookmark | null;
};
