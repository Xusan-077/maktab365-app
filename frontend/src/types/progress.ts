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
  /** Yozuv paydo bo'lgan vaqt (ISO): eski qurilmaning kech kelgan yozuvi yangisini bosmaydi. */
  updatedAt?: string;
};

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

export interface MergeResult {
  progress: number;
  bookmarks: number;
  /** Qo'shib bo'lmagan mavzu/kitob id'lari (masalan, mavzu endi yo'q). */
  failed: string[];
}

/** Mashq natijasi bo'yicha mavzu holati: takrorlash kerak / yaxshi o'zlashtirilgan / jarayonda. */
export type ResultGroup = "review" | "mastered" | "inProgress";

export type DashboardBook = {
  bookId: string;
  subjectId: string;
  grade: number;
  topicsTotal: number;
  topicsRead: number;
  topicsPassed: number;
};

export type WeeklyStats = {
  /** ISO sana: hisob boshlangan vaqt. */
  since: string;
  finished: number;
  read: number;
  exercisesPassed: number;
  mistakes: number;
  active: number;
};

/** O'quvchi kabinetining bosh sahifasi (`GET /me/dashboard/`). */
export type Dashboard = {
  continue: Progress | null;
  /** `continue` bo'sh bo'lganda: hech narsa boshlanmaganmi (false) yoki hammasi tugaganmi (true). */
  hasProgress: boolean;
  subjects: DashboardBook[];
  review: { count: number; items: Progress[] };
  weekly: WeeklyStats;
  savedCount: number;
};

/** "Natijalar" (`GET /me/results/`): mavzu kesimida. */
export type Results = Record<ResultGroup, Progress[]> & {
  counts: Record<ResultGroup, number>;
};

export type RecentTopic = {
  topicId: string;
  bookId: string;
  /** ISO sana. */
  viewedAt: string;
};

/** O'qituvchi bosh sahifasi (`GET /me/teacher/dashboard/`). */
export type TeacherDashboard = {
  recent: RecentTopic[];
  savedTopics: Bookmark[];
  savedBooks: BookBookmark[];
  savedTopicsCount: number;
  savedBooksCount: number;
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
