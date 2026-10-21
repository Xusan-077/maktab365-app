import { getApiSession, type ApiSession } from "@/lib/api/session";
import { ApiError, type HealthStatus, type MaktabApi } from "@/lib/api/types";
import { EXERCISE_TO_API, READ_TO_API } from "@/lib/api/learning-mappers";
import { mergeBookmarks, mergeProgress } from "@/lib/merge-guest-data";
import { groupByMastery, hasActivity, pickContinue, reviewTopics } from "@/lib/progress/review";
import { EXERCISE_RANK, maxBy, mergeAttempts, READ_RANK } from "@/lib/progress/status";
import { weeklySummary } from "@/lib/progress/summary";
import { latinToCyrillic } from "@/lib/i18n/translit";
import type { Book, BookFilters, Chapter, Grade, Subject } from "@/types/catalog";
import { GRADES } from "@/types/catalog";
import type { SupportInput, SupportMessage } from "@/types/support";
import type { StudyGoal, UpdateGoalInput } from "@/types/goal";
import type { LocalizedText } from "@/types/i18n";
import type {
  BookBookmark,
  Bookmark,
  Dashboard,
  GuestData,
  MergeResult,
  Progress,
  ProgressFilters,
  RecentTopic,
  Results,
  SaveProgressInput,
  TeacherDashboard,
  ToggleBookBookmarkResult,
  ToggleBookmarkResult,
} from "@/types/progress";
import type { Topic, TopicSearchFilters, TopicSearchResult } from "@/types/topic";
import type { AccountExport, ProfileInput, UpdateProfileInput, User, UserRole } from "@/types/user";
import { BOOKS } from "./data/books";
import { CHAPTERS, TOPICS } from "./data/chapters";
import { SUBJECTS } from "./data/subjects";

const SEARCH_LIMIT = 20;
const RECENT_LIMIT = 20;
const DASHBOARD_REVIEW_LIMIT = 4;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Kichik harf, bir xil tutuq belgisi — lotin va kirill so'rovlarini solishtirish uchun. */
function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[ʻʼ‘’`´]/g, "'")
    .trim();
}

/** Matnning barcha tillardagi variantlari + uz'ning kirillcha ko'rinishi. */
function searchableForms(text: LocalizedText): string[] {
  return [text.uz, latinToCyrillic(text.uz), text.ru, text.en]
    .filter((value): value is string => !!value)
    .map(normalize);
}

const matches = (query: string, ...texts: LocalizedText[]) =>
  texts.some((text) => searchableForms(text).some((form) => form.includes(query)));

/** Kitob boblari yoki mavzulari nomi so'rovga mos keladimi. */
const bookHasTopicMatching = (bookId: string, query: string) =>
  CHAPTERS.some(
    (chapter) =>
      chapter.bookId === bookId &&
      (matches(query, chapter.title) ||
        chapter.topics.some((topic) => matches(query, topic.title))),
  );

/** Backend tayyor bo'lguncha `MaktabApi` ning xotiradagi amalga oshirilishi. Holat jarayon xotirasida turadi. */
export const MOCK_DB_STORAGE_KEY = "maktab365-mock-db";

/** Bitta akkauntning mock ma'lumotlari. */
interface AccountDb {
  user: User | null;
  progress: Record<string, Progress>;
  bookmarks: Record<string, Bookmark>;
  bookmarkSeq: number;
  bookBookmarks: Record<string, BookBookmark>;
  goals: Record<string, StudyGoal>;
  goalSeq: number;
  support: SupportMessage[];
  /** Oxirgi ochilgan mavzular, eng yangisi birinchi. */
  recent: RecentTopic[];
}

type MockStorage = Pick<Storage, "getItem" | "setItem">;

export interface MockApiOptions {
  latencyMs?: number;
  /** Joriy akkaunt (default: `setApiSession` orqali berilgan Auth.js sessiyasi). */
  session?: () => ApiSession | null;
  /** Akkaunt ma'lumotlari saqlanadigan joy (default: brauzerda localStorage, aks holda xotira). */
  storage?: MockStorage;
}

/** Backend tayyor bo'lguncha `MaktabApi` ning amalga oshirilishi. Akkaunt holati sessiya id'si bo'yicha saqlanadi. */
export class MockApi implements MaktabApi {
  private memory: Record<string, AccountDb> = {};

  constructor(private readonly options: MockApiOptions = {}) {}

  async health(): Promise<HealthStatus> {
    return { status: "ok", checks: { database: "ok", redis: "ok" } };
  }

  private get storage(): MockStorage | undefined {
    return this.options.storage ?? (typeof localStorage === "undefined" ? undefined : localStorage);
  }

  private session(): ApiSession {
    const session = (this.options.session ?? getApiSession)();
    if (!session) throw new ApiError("Kirish talab qilinadi", 401);
    return session;
  }

  private readAll(): Record<string, AccountDb> {
    const raw = this.storage?.getItem(MOCK_DB_STORAGE_KEY);
    if (raw) {
      try {
        return JSON.parse(raw) as Record<string, AccountDb>;
      } catch {
        // buzilgan yozuv — xotiradagi nusxaga qaytamiz
      }
    }
    return this.memory;
  }

  /** Akkaunt holatini o'qib, `change` bilan o'zgartiradi va saqlaydi. */
  private withAccount<T>(change: (db: AccountDb, session: ApiSession) => T): T {
    const session = this.session();
    const all = this.readAll();
    // Eski saqlangan yozuvlarda yangi maydonlar bo'lmasligi mumkin, shuning uchun bo'sh qiymatlar ustiga yoyiladi
    const empty: AccountDb = {
      user: null,
      progress: {},
      bookmarks: {},
      bookmarkSeq: 0,
      bookBookmarks: {},
      goals: {},
      goalSeq: 0,
      support: [],
      recent: [],
    };
    const db: AccountDb = { ...empty, ...all[session.id] };
    const result = change(db, session);
    all[session.id] = db;
    this.memory = all;
    this.storage?.setItem(MOCK_DB_STORAGE_KEY, JSON.stringify(all));
    return result;
  }

  private async respond<T>(produce: () => T): Promise<T> {
    const { latencyMs = 0 } = this.options;
    if (latencyMs > 0) await new Promise((resolve) => setTimeout(resolve, latencyMs));
    return structuredClone(produce());
  }

  private findTopic(topicId: string): Topic {
    const topic = TOPICS.find((item) => item.id === topicId);
    if (!topic) throw new ApiError(`Mavzu topilmadi: ${topicId}`, 404);
    return topic;
  }

  getGrades(): Promise<Grade[]> {
    return this.respond(() => [...GRADES]);
  }

  getSubjects(): Promise<Subject[]> {
    return this.respond(() => SUBJECTS);
  }

  getBooks(filters: BookFilters = {}): Promise<Book[]> {
    return this.respond(() => {
      const query = filters.q ? normalize(filters.q) : "";
      return BOOKS.filter(
        (book) =>
          (filters.grade === undefined || book.grade === filters.grade) &&
          (filters.subjectId === undefined || book.subjectId === filters.subjectId) &&
          (!query ||
            matches(query, book.title, book.author) ||
            bookHasTopicMatching(book.id, query)),
      );
    });
  }

  getBook(bookId: string): Promise<Book> {
    return this.respond(() => {
      const book = BOOKS.find((item) => item.id === bookId);
      if (!book) throw new ApiError(`Kitob topilmadi: ${bookId}`, 404);
      return book;
    });
  }

  getChapters(bookId: string): Promise<Chapter[]> {
    return this.respond(() => {
      if (!BOOKS.some((book) => book.id === bookId)) {
        throw new ApiError(`Kitob topilmadi: ${bookId}`, 404);
      }
      return CHAPTERS.filter((chapter) => chapter.bookId === bookId);
    });
  }

  getTopic(topicId: string): Promise<Topic> {
    return this.respond(() => this.findTopic(topicId));
  }

  searchTopics(query: string, filters: TopicSearchFilters = {}): Promise<TopicSearchResult[]> {
    return this.respond(() => {
      const needle = normalize(query);
      if (!needle) return [];
      const results: TopicSearchResult[] = [];
      for (const chapter of CHAPTERS) {
        if (filters.bookId && chapter.bookId !== filters.bookId) continue;
        const book = BOOKS.find((item) => item.id === chapter.bookId);
        if (!book) continue;
        for (const topic of chapter.topics) {
          if (matches(needle, topic.title, chapter.title, book.title)) {
            results.push({ topic, bookTitle: book.title, chapterTitle: chapter.title });
          }
        }
      }
      return results.slice(0, SEARCH_LIMIT);
    });
  }

  getProgress(filters: ProgressFilters = {}): Promise<Progress[]> {
    return this.respond(() =>
      this.withAccount((db) =>
        Object.values(db.progress).filter(
          (item) =>
            (filters.topicId === undefined || item.topicId === filters.topicId) &&
            (filters.bookId === undefined ||
              this.findTopic(item.topicId).bookId === filters.bookId),
        ),
      ),
    );
  }

  saveProgress(input: SaveProgressInput): Promise<Progress> {
    return this.respond(() => {
      this.findTopic(input.topicId);
      return this.withAccount((db, session) => {
        const current: Progress = db.progress[input.topicId] ?? {
          userId: session.id,
          topicId: input.topicId,
          readStatus: "none",
          exerciseStatus: "none",
          updatedAt: "",
          mistakes: [],
        };
        // Shartnoma: holatlar pastga tushmaydi (boshqa qurilma oldinroq yuborgan bo'lishi mumkin),
        // yechilgan mashqlar birlashadi, urinishlar eng kattasini oladi; xatolar ro'yxati almashtiriladi.
        const next: Progress = {
          ...current,
          readStatus: maxBy(READ_RANK, current.readStatus, input.readStatus) ?? "none",
          exerciseStatus:
            maxBy(EXERCISE_RANK, current.exerciseStatus, input.exerciseStatus) ?? "none",
          lastBlockId: input.lastBlockId ?? current.lastBlockId,
          mistakes: input.mistakes ?? current.mistakes,
          solved: [...new Set([...(current.solved ?? []), ...(input.solved ?? [])])],
          attempts: mergeAttempts(current.attempts, input.attempts),
          updatedAt: new Date().toISOString(),
        };
        db.progress[input.topicId] = next;
        return next;
      });
    });
  }

  recordTopicOpened(topicId: string): Promise<void> {
    return this.respond(() => {
      const topic = this.findTopic(topicId);
      this.withAccount((db) => {
        const rest = db.recent.filter((item) => item.topicId !== topicId);
        db.recent = [
          { topicId, bookId: topic.bookId, viewedAt: new Date().toISOString() },
          ...rest,
        ].slice(0, RECENT_LIMIT);
      });
    });
  }

  getRecent(): Promise<RecentTopic[]> {
    return this.respond(() => this.withAccount((db) => db.recent));
  }

  getDashboard(): Promise<Dashboard> {
    return this.respond(() =>
      this.withAccount((db) => {
        const progress = Object.values(db.progress);
        const review = reviewTopics(progress);
        const weekly = weeklySummary(progress, new Date());
        const grade = db.user?.role === "student" ? db.user.grade : undefined;
        const subjects =
          grade === undefined
            ? []
            : BOOKS.filter((book) => book.grade === grade).flatMap((book) => {
                const topics = TOPICS.filter((topic) => topic.bookId === book.id && topic.ready);
                const own = progress.filter((item) =>
                  topics.some((topic) => topic.id === item.topicId),
                );
                return topics.length === 0
                  ? []
                  : [
                      {
                        bookId: book.id,
                        subjectId: book.subjectId,
                        grade: book.grade,
                        topicsTotal: topics.length,
                        topicsRead: own.filter((item) => item.readStatus === "completed").length,
                        topicsPassed: own.filter((item) => item.exerciseStatus === "completed")
                          .length,
                      },
                    ];
              });
        return {
          continue: pickContinue(progress) ?? null,
          hasProgress: progress.some(hasActivity),
          subjects,
          review: { count: review.length, items: review.slice(0, DASHBOARD_REVIEW_LIMIT) },
          weekly: {
            since: new Date(Date.now() - WEEK_MS).toISOString(),
            finished: weekly.finished,
            read: weekly.read,
            exercisesPassed: weekly.exercisesPassed,
            mistakes: weekly.mistakes,
            active: weekly.active,
          },
          savedCount: Object.keys(db.bookmarks).length,
        };
      }),
    );
  }

  getResults(): Promise<Results> {
    return this.respond(() =>
      this.withAccount((db) => {
        const groups = groupByMastery(Object.values(db.progress));
        return {
          ...groups,
          counts: {
            mastered: groups.mastered.length,
            review: groups.review.length,
            inProgress: groups.inProgress.length,
          },
        };
      }),
    );
  }

  getTeacherDashboard(): Promise<TeacherDashboard> {
    return this.respond(() =>
      this.withAccount((db) => {
        const newest = <T extends { createdAt: string }>(items: T[]) =>
          [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, RECENT_LIMIT);
        return {
          recent: db.recent,
          savedTopics: newest(Object.values(db.bookmarks)),
          savedBooks: newest(Object.values(db.bookBookmarks)),
          savedTopicsCount: Object.keys(db.bookmarks).length,
          savedBooksCount: Object.keys(db.bookBookmarks).length,
        };
      }),
    );
  }

  mergeGuestData(data: GuestData): Promise<MergeResult> {
    return this.respond(() =>
      this.withAccount((db, session) => {
        const result: MergeResult = { progress: 0, bookmarks: 0, failed: [] };
        const known = (topicId: string) => TOPICS.some((topic) => topic.id === topicId);
        for (const [topicId, guest] of Object.entries(data.progress)) {
          if (!known(topicId)) {
            result.failed.push(topicId);
            continue;
          }
          const input = mergeProgress(topicId, db.progress[topicId], guest);
          if (!input) continue;
          const current = db.progress[topicId];
          db.progress[topicId] = {
            userId: session.id,
            topicId,
            readStatus: input.readStatus ?? current?.readStatus ?? "none",
            exerciseStatus: input.exerciseStatus ?? current?.exerciseStatus ?? "none",
            lastBlockId: input.lastBlockId ?? current?.lastBlockId,
            mistakes: input.mistakes ?? current?.mistakes ?? [],
            solved: input.solved ?? current?.solved,
            attempts: input.attempts ?? current?.attempts,
            updatedAt: new Date().toISOString(),
          };
          result.progress++;
        }
        for (const topicId of mergeBookmarks(Object.keys(db.bookmarks), data.bookmarks)) {
          if (!known(topicId)) {
            result.failed.push(topicId);
            continue;
          }
          db.bookmarks[topicId] = {
            id: `bookmark-${++db.bookmarkSeq}`,
            userId: session.id,
            topicId,
            createdAt: new Date().toISOString(),
          };
          result.bookmarks++;
        }
        return result;
      }),
    );
  }

  getBookmarks(): Promise<Bookmark[]> {
    return this.respond(() => this.withAccount((db) => Object.values(db.bookmarks)));
  }

  toggleBookmark(topicId: string): Promise<ToggleBookmarkResult> {
    return this.respond(() => {
      this.findTopic(topicId);
      return this.withAccount((db, session) => {
        if (db.bookmarks[topicId]) {
          delete db.bookmarks[topicId];
          return { bookmarked: false, bookmark: null };
        }
        const bookmark: Bookmark = {
          id: `bookmark-${++db.bookmarkSeq}`,
          userId: session.id,
          topicId,
          createdAt: new Date().toISOString(),
        };
        db.bookmarks[topicId] = bookmark;
        return { bookmarked: true, bookmark };
      });
    });
  }

  setBookmark(topicId: string, bookmarked: boolean): Promise<ToggleBookmarkResult> {
    return this.respond(() => {
      this.findTopic(topicId);
      return this.withAccount((db, session) => {
        const existing = db.bookmarks[topicId];
        if (!bookmarked) {
          delete db.bookmarks[topicId];
          return { bookmarked: false, bookmark: null };
        }
        if (existing) return { bookmarked: true, bookmark: existing };
        const bookmark: Bookmark = {
          id: `bookmark-${++db.bookmarkSeq}`,
          userId: session.id,
          topicId,
          createdAt: new Date().toISOString(),
        };
        db.bookmarks[topicId] = bookmark;
        return { bookmarked: true, bookmark };
      });
    });
  }

  getBookBookmarks(): Promise<BookBookmark[]> {
    return this.respond(() => this.withAccount((db) => Object.values(db.bookBookmarks)));
  }

  toggleBookBookmark(bookId: string): Promise<ToggleBookBookmarkResult> {
    return this.respond(() => {
      if (!BOOKS.some((book) => book.id === bookId)) {
        throw new ApiError(`Kitob topilmadi: ${bookId}`, 404);
      }
      return this.withAccount((db, session) => {
        if (db.bookBookmarks[bookId]) {
          delete db.bookBookmarks[bookId];
          return { bookmarked: false, bookmark: null };
        }
        const bookmark: BookBookmark = {
          id: `book-bookmark-${++db.bookmarkSeq}`,
          userId: session.id,
          bookId,
          createdAt: new Date().toISOString(),
        };
        db.bookBookmarks[bookId] = bookmark;
        return { bookmarked: true, bookmark };
      });
    });
  }

  getMe(): Promise<User | null> {
    return this.respond(() => {
      if (!(this.options.session ?? getApiSession)()) return null;
      return this.withAccount((db) => db.user);
    });
  }

  saveProfile(input: ProfileInput): Promise<User> {
    return this.respond(() => {
      const name = input.name.trim();
      if (!name) throw new ApiError("Ism bo'sh bo'lmasligi kerak", 400);
      return this.withAccount((db, session) => {
        const user: User =
          input.role === "student"
            ? { id: session.id, role: "student", name, grade: input.grade }
            : {
                id: session.id,
                role: "teacher",
                name,
                subjects: input.subjects,
                grades: input.grades,
              };
        db.user = user;
        return user;
      });
    });
  }

  updateProfile(input: UpdateProfileInput): Promise<User> {
    return this.respond(() => {
      const name = input.name?.trim();
      if (input.name !== undefined && !name) throw new ApiError("Ism bo'sh bo'lmasligi kerak", 400);
      return this.withAccount((db) => {
        const user = db.user;
        if (!user) throw new ApiError("Profil topilmadi", 404);
        db.user =
          user.role === "student"
            ? {
                ...user,
                ...(name && { name }),
                ...(input.grade !== undefined && { grade: input.grade }),
              }
            : {
                ...user,
                ...(name && { name }),
                ...(input.subjects && { subjects: input.subjects }),
                ...(input.grades && { grades: input.grades }),
              };
        return db.user;
      });
    });
  }

  setRole(role: UserRole): Promise<User> {
    return this.respond(() =>
      this.withAccount((db) => {
        const user = db.user;
        if (!user) throw new ApiError("Profil topilmadi", 404);
        if (user.role === role) return user;
        db.user =
          role === "student"
            ? { id: user.id, role, name: user.name }
            : { id: user.id, role, name: user.name, subjects: [], grades: [] };
        return db.user;
      }),
    );
  }

  deleteAccount(): Promise<void> {
    return this.respond(() => {
      const session = this.session();
      const all = this.readAll();
      delete all[session.id];
      this.memory = all;
      this.storage?.setItem(MOCK_DB_STORAGE_KEY, JSON.stringify(all));
    });
  }

  exportData(): Promise<AccountExport> {
    return this.respond(() =>
      this.withAccount((db, session) => {
        const user = db.user;
        return {
          exported_at: new Date().toISOString(),
          user: {
            id: session.id,
            email: null,
            email_verified_at: null,
            role: user?.role ?? "student",
            date_joined: new Date(0).toISOString(),
            last_login: null,
          },
          profile: {
            display_name: user?.name ?? "",
            avatar_url: "",
            locale: "uz",
            grade: user?.role === "student" ? (user.grade ?? null) : null,
            subjects: user?.role === "teacher" ? (user.subjects ?? []) : [],
            grades: user?.role === "teacher" ? (user.grades ?? []) : [],
            onboarded_at: user ? new Date(0).toISOString() : null,
          },
          identities: [],
          auth_events: [],
          learning: {
            progress: Object.values(db.progress).map((item) => ({
              topic_id: item.topicId,
              book_id: this.findTopic(item.topicId).bookId,
              read_status: READ_TO_API[item.readStatus],
              exercise_status: EXERCISE_TO_API[item.exerciseStatus],
              last_block_id: item.lastBlockId ?? "",
              mistakes: item.mistakes.map((id) => ({
                exercise_id: id,
                attempts: item.attempts?.[id] ?? 1,
                last_wrong_at: null,
              })),
              exercise_stats: { solved: item.solved ?? [], attempts: item.attempts ?? {} },
              updated_at: item.updatedAt,
            })),
            bookmarks: Object.values(db.bookmarks).map((item) => ({
              id: item.id,
              kind: "topic" as const,
              topic_id: item.topicId,
              book_id: null,
              created_at: item.createdAt,
            })),
            goals: Object.values(db.goals).map((goal) => ({
              id: goal.id,
              title: goal.title,
              topic_id: null,
              done: goal.done,
              created_at: goal.createdAt,
            })),
          },
        };
      }),
    );
  }

  getGoals(): Promise<StudyGoal[]> {
    return this.respond(() =>
      this.withAccount((db) =>
        Object.values(db.goals).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      ),
    );
  }

  createGoal(title: string): Promise<StudyGoal> {
    return this.respond(() => {
      const trimmed = title.trim();
      if (!trimmed) throw new ApiError("Maqsad bo'sh bo'lmasligi kerak", 400);
      return this.withAccount((db, session) => {
        const goal: StudyGoal = {
          id: `goal-${++db.goalSeq}`,
          userId: session.id,
          title: trimmed,
          done: false,
          createdAt: new Date().toISOString(),
        };
        db.goals[goal.id] = goal;
        return goal;
      });
    });
  }

  updateGoal(goalId: string, input: UpdateGoalInput): Promise<StudyGoal> {
    return this.respond(() => {
      const title = input.title?.trim();
      if (input.title !== undefined && !title) {
        throw new ApiError("Maqsad bo'sh bo'lmasligi kerak", 400);
      }
      return this.withAccount((db) => {
        const goal = db.goals[goalId];
        if (!goal) throw new ApiError(`Maqsad topilmadi: ${goalId}`, 404);
        const next: StudyGoal = {
          ...goal,
          ...(title && { title }),
          ...(input.done !== undefined && { done: input.done }),
        };
        db.goals[goalId] = next;
        return next;
      });
    });
  }

  deleteGoal(goalId: string): Promise<void> {
    return this.respond(() =>
      this.withAccount((db) => {
        if (!db.goals[goalId]) throw new ApiError(`Maqsad topilmadi: ${goalId}`, 404);
        delete db.goals[goalId];
      }),
    );
  }

  sendSupport(input: SupportInput): Promise<void> {
    return this.respond(() => {
      const message = input.message.trim();
      if (!message) throw new ApiError("Xabar bo'sh bo'lmasligi kerak", 400);
      // Mehmon ham yubora oladi (backend kabi); mock'da u saqlanmaydi.
      if (!(this.options.session ?? getApiSession)()) return;
      this.withAccount((db) => {
        db.support.unshift({
          id: `support-${db.support.length + 1}`,
          kind: input.kind,
          message,
          topic: input.topic ?? "",
          pageUrl: input.pageUrl ?? "",
          status: "new",
          createdAt: new Date().toISOString(),
        });
      });
    });
  }

  getMySupport(): Promise<SupportMessage[]> {
    return this.respond(() => this.withAccount((db) => db.support));
  }
}
