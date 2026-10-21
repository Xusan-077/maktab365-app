import { createHttpClient, toApiError, unwrap, type HttpClient } from "./http-client";
import {
  toBook,
  toChapters,
  toSearchResult,
  toSubject,
  toTopic,
  topicSlugOf,
} from "./catalog-mappers";
import {
  toOnboardedUser,
  toOnboardingRequest,
  toProfileUpdateRequest,
  toSupportMessage,
  toSupportRequest,
  toUser,
} from "./mappers";
import {
  toBookBookmark,
  toBookmark,
  toDashboard,
  toGoal,
  toGoalPatch,
  toMergeRequest,
  toMergeResult,
  toProgress,
  toProgressRequest,
  toRecentTopic,
  toResults,
  toTeacherDashboard,
} from "./learning-mappers";
import { getApiSession } from "./session";
import { ApiError, type HealthStatus, type MaktabApi } from "./types";
import {
  GRADES,
  type Book,
  type BookFilters,
  type Chapter,
  type Grade,
  type Subject,
} from "@/types/catalog";
import type { StudyGoal, UpdateGoalInput } from "@/types/goal";
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
import type { SupportInput, SupportMessage } from "@/types/support";
import type { Topic, TopicSearchFilters, TopicSearchResult } from "@/types/topic";
import type { AccountExport, ProfileInput, UpdateProfileInput, User, UserRole } from "@/types/user";

const BOOKS_PAGE_SIZE = 100;
const MAX_BOOK_PAGES = 20;
const BOOK_IDS_TTL_MS = 30_000;

/** DRF klienti. Endpoint'lar tayyor bo'lganda har bir metod haqiqiy so'rovga almashtiriladi. */
export class HttpApi implements MaktabApi {
  private bookIdsMemo?: { at: number; request: Promise<string[]> };

  constructor(private readonly client: HttpClient = createHttpClient()) {}

  /** Joriy akkaunt id'si (faqat UI modelida kerak; backend tokendan aniqlaydi). */
  private userId(): string {
    return getApiSession()?.id ?? "";
  }

  async health(): Promise<HealthStatus> {
    const result = await this.client.GET("/api/v1/health/");
    // 503 da ham tanada holat (`degraded`) bo'ladi — bu xato emas, ma'lumot.
    if (result.response.status === 503 && isHealth(result.error)) return result.error;
    if (result.response.status >= 400) throw toApiError(result.response, result.error);
    return unwrap(result);
  }

  /** Kirmagan (401) yoki onboarding tugamagan foydalanuvchi uchun `null`. */
  async getMe(): Promise<User | null> {
    const result = await this.client.GET("/api/v1/me/");
    if (result.response.status === 401) return null;
    return toOnboardedUser(unwrap(result));
  }

  async saveProfile(input: ProfileInput): Promise<User> {
    const result = await this.client.POST("/api/v1/me/onboarding/", {
      body: toOnboardingRequest(input),
    });
    return toUser(unwrap(result));
  }

  async updateProfile(input: UpdateProfileInput): Promise<User> {
    const result = await this.client.PATCH("/api/v1/me/", { body: toProfileUpdateRequest(input) });
    return toUser(unwrap(result));
  }

  async setRole(role: UserRole): Promise<User> {
    const result = await this.client.PATCH("/api/v1/me/role/", { body: { role } });
    return toUser(unwrap(result));
  }

  async deleteAccount(): Promise<void> {
    const result = await this.client.DELETE("/api/v1/me/");
    if (result.response.status >= 400) throw toApiError(result.response, result.error);
  }

  async exportData(): Promise<AccountExport> {
    return unwrap(await this.client.GET("/api/v1/me/export/"));
  }

  /** Sinflar 1–11 (kitobsiz sinflar ham ro'yxatda: filtr chiplari doim to'liq). */
  async getGrades(): Promise<Grade[]> {
    const grades = unwrap(await this.client.GET("/api/v1/grades/")).map((item) => item.grade);
    return GRADES.filter((grade) => grades.includes(grade));
  }

  async getSubjects(): Promise<Subject[]> {
    return unwrap(await this.client.GET("/api/v1/subjects/")).map(toSubject);
  }

  /** Barcha sahifalarni yig'adi (katalog kichik: bitta so'rovda 100 tagacha). */
  async getBooks(filters: BookFilters = {}): Promise<Book[]> {
    const books: Book[] = [];
    for (let page = 1; page <= MAX_BOOK_PAGES; page += 1) {
      const data = unwrap(
        await this.client.GET("/api/v1/books/", {
          params: {
            query: {
              grade: filters.grade,
              subject: filters.subjectId,
              q: filters.q?.trim() || undefined,
              page,
              page_size: BOOKS_PAGE_SIZE,
            },
          },
        }),
      );
      books.push(...data.results.map(toBook));
      if (!data.next) break;
    }
    return books;
  }

  async getBook(bookId: string): Promise<Book> {
    return toBook(await this.fetchBook(bookId));
  }

  async getChapters(bookId: string): Promise<Chapter[]> {
    return toChapters(await this.fetchBook(bookId));
  }

  /** Mavzu id'si `{kitob}-{mavzu}`: kitob slug'i kitoblar ro'yxatidan (eng uzun mos prefiks) aniqlanadi. */
  async getTopic(topicId: string): Promise<Topic> {
    const books = await this.bookIds();
    const bookId = books
      .filter((id) => topicSlugOf(id, topicId))
      .sort((a, b) => b.length - a.length)[0];
    const slug = bookId ? topicSlugOf(bookId, topicId) : null;
    if (!bookId || !slug) {
      throw new ApiError(`Mavzu topilmadi: ${topicId}`, 404, { code: "not_found" });
    }
    const result = await this.client.GET("/api/v1/books/{book}/topics/{topic}/", {
      params: { path: { book: bookId, topic: slug } },
    });
    return toTopic(unwrap(result));
  }

  async searchTopics(
    query: string,
    filters: TopicSearchFilters = {},
  ): Promise<TopicSearchResult[]> {
    const q = query.trim();
    if (!q) return [];
    const result = await this.client.GET("/api/v1/search/", {
      params: { query: { q, book: filters.bookId } },
    });
    return unwrap(result).results.map(toSearchResult);
  }

  private async fetchBook(bookId: string) {
    return unwrap(
      await this.client.GET("/api/v1/books/{slug}/", { params: { path: { slug: bookId } } }),
    );
  }

  /** Kitob id'lari; mavzu id'sini ajratish uchun qisqa muddat eslab qolinadi. */
  private bookIds(): Promise<string[]> {
    // `performance.now()`: Cache Components prerender'da `Date.now()` ni qabul qilmaydi.
    const now = performance.now();
    if (!this.bookIdsMemo || now - this.bookIdsMemo.at > BOOK_IDS_TTL_MS) {
      const request = this.getBooks().then((books) => books.map((book) => book.id));
      request.catch(() => {
        this.bookIdsMemo = undefined;
      });
      this.bookIdsMemo = { at: now, request };
    }
    return this.bookIdsMemo.request;
  }

  async sendSupport(input: SupportInput): Promise<void> {
    unwrap(await this.client.POST("/api/v1/support/", { body: toSupportRequest(input) }));
  }

  async getMySupport(): Promise<SupportMessage[]> {
    const page = unwrap(
      await this.client.GET("/api/v1/me/support/", { params: { query: { page_size: 50 } } }),
    );
    return page.results.map(toSupportMessage);
  }

  async getProgress(filters: ProgressFilters = {}): Promise<Progress[]> {
    const result = await this.client.GET("/api/v1/me/progress/", {
      params: { query: { topic: filters.topicId, book: filters.bookId } },
    });
    return unwrap(result).map((item) => toProgress(item, this.userId()));
  }

  async saveProgress(input: SaveProgressInput): Promise<Progress> {
    const result = await this.client.PUT("/api/v1/me/progress/{topic_id}/", {
      params: { path: { topic_id: input.topicId } },
      body: toProgressRequest(input),
    });
    return toProgress(unwrap(result), this.userId());
  }

  async recordTopicOpened(topicId: string): Promise<void> {
    unwrap(
      await this.client.POST("/api/v1/me/events/", {
        body: { type: "topic_opened", topic_id: topicId, attempt: 1 },
      }),
    );
  }

  async getRecent(): Promise<RecentTopic[]> {
    return unwrap(await this.client.GET("/api/v1/me/recent/")).map(toRecentTopic);
  }

  async getDashboard(): Promise<Dashboard> {
    return toDashboard(unwrap(await this.client.GET("/api/v1/me/dashboard/")), this.userId());
  }

  async getResults(): Promise<Results> {
    return toResults(unwrap(await this.client.GET("/api/v1/me/results/")), this.userId());
  }

  async getTeacherDashboard(): Promise<TeacherDashboard> {
    return toTeacherDashboard(
      unwrap(await this.client.GET("/api/v1/me/teacher/dashboard/")),
      this.userId(),
    );
  }

  async mergeGuestData(data: GuestData): Promise<MergeResult> {
    const result = await this.client.POST("/api/v1/me/merge-guest-data/", {
      body: toMergeRequest(data),
    });
    return toMergeResult(unwrap(result));
  }

  async getBookmarks(): Promise<Bookmark[]> {
    const result = await this.client.GET("/api/v1/me/bookmarks/", {
      params: { query: { kind: "topic" } },
    });
    return unwrap(result).map((item) => toBookmark(item, this.userId()));
  }

  async setBookmark(topicId: string, bookmarked: boolean): Promise<ToggleBookmarkResult> {
    if (!bookmarked) {
      await this.removeBookmark({ kind: "topic", topic_id: topicId });
      return { bookmarked: false, bookmark: null };
    }
    const result = await this.client.POST("/api/v1/me/bookmarks/", {
      body: { kind: "topic", topic_id: topicId },
    });
    return { bookmarked: true, bookmark: toBookmark(unwrap(result), this.userId()) };
  }

  async toggleBookmark(topicId: string): Promise<ToggleBookmarkResult> {
    // Takror POST 200 qaytaradi (xatcho'p allaqachon bor) — shunda olib tashlanadi.
    const result = await this.client.POST("/api/v1/me/bookmarks/", {
      body: { kind: "topic", topic_id: topicId },
    });
    const bookmark = unwrap(result);
    if (result.response.status === 201) {
      return { bookmarked: true, bookmark: toBookmark(bookmark, this.userId()) };
    }
    await this.removeBookmark({ kind: "topic", topic_id: topicId });
    return { bookmarked: false, bookmark: null };
  }

  async getBookBookmarks(): Promise<BookBookmark[]> {
    const result = await this.client.GET("/api/v1/me/bookmarks/", {
      params: { query: { kind: "book" } },
    });
    return unwrap(result).map((item) => toBookBookmark(item, this.userId()));
  }

  async toggleBookBookmark(bookId: string): Promise<ToggleBookBookmarkResult> {
    const result = await this.client.POST("/api/v1/me/bookmarks/", {
      body: { kind: "book", book_id: bookId },
    });
    const bookmark = unwrap(result);
    if (result.response.status === 201) {
      return { bookmarked: true, bookmark: toBookBookmark(bookmark, this.userId()) };
    }
    await this.removeBookmark({ kind: "book", book_id: bookId });
    return { bookmarked: false, bookmark: null };
  }

  private async removeBookmark(query: {
    kind: "topic" | "book";
    topic_id?: string;
    book_id?: string;
  }) {
    const result = await this.client.DELETE("/api/v1/me/bookmarks/", { params: { query } });
    if (result.response.status >= 400) throw toApiError(result.response, result.error);
  }

  async getGoals(): Promise<StudyGoal[]> {
    const result = await this.client.GET("/api/v1/me/goals/");
    return unwrap(result).map((item) => toGoal(item, this.userId()));
  }

  async createGoal(title: string): Promise<StudyGoal> {
    const result = await this.client.POST("/api/v1/me/goals/", { body: { title: title.trim() } });
    return toGoal(unwrap(result), this.userId());
  }

  async updateGoal(goalId: string, input: UpdateGoalInput): Promise<StudyGoal> {
    const result = await this.client.PATCH("/api/v1/me/goals/{goal_id}/", {
      params: { path: { goal_id: goalId } },
      body: toGoalPatch(input),
    });
    return toGoal(unwrap(result), this.userId());
  }

  async deleteGoal(goalId: string): Promise<void> {
    const result = await this.client.DELETE("/api/v1/me/goals/{goal_id}/", {
      params: { path: { goal_id: goalId } },
    });
    if (result.response.status >= 400) throw toApiError(result.response, result.error);
  }
}

function isHealth(value: unknown): value is HealthStatus {
  return typeof value === "object" && value !== null && "status" in value && "checks" in value;
}
