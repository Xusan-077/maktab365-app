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
import { ApiError, type HealthStatus, type MaktabApi } from "./types";
import {
  GRADES,
  type Book,
  type BookFilters,
  type Chapter,
  type Grade,
  type Subject,
} from "@/types/catalog";
import type { SupportInput, SupportMessage } from "@/types/support";
import type { Topic, TopicSearchFilters, TopicSearchResult } from "@/types/topic";
import type { AccountExport, ProfileInput, UpdateProfileInput, User, UserRole } from "@/types/user";

const notImplemented = (method: string) => async (): Promise<never> => {
  throw new ApiError(`HttpApi.${method} keyingi bosqichda yoziladi`, 501, {
    code: "not_implemented",
  });
};

const BOOKS_PAGE_SIZE = 100;
const MAX_BOOK_PAGES = 20;
const BOOK_IDS_TTL_MS = 30_000;

/** DRF klienti. Endpoint'lar tayyor bo'lganda har bir metod haqiqiy so'rovga almashtiriladi. */
export class HttpApi implements MaktabApi {
  private bookIdsMemo?: { at: number; request: Promise<string[]> };

  constructor(private readonly client: HttpClient = createHttpClient()) {}

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

  getProgress = notImplemented("getProgress");
  saveProgress = notImplemented("saveProgress");
  getBookmarks = notImplemented("getBookmarks");
  toggleBookmark = notImplemented("toggleBookmark");
  setBookmark = notImplemented("setBookmark");
  getBookBookmarks = notImplemented("getBookBookmarks");
  toggleBookBookmark = notImplemented("toggleBookBookmark");
  getGoals = notImplemented("getGoals");
  createGoal = notImplemented("createGoal");
  updateGoal = notImplemented("updateGoal");
  deleteGoal = notImplemented("deleteGoal");
}

function isHealth(value: unknown): value is HealthStatus {
  return typeof value === "object" && value !== null && "status" in value && "checks" in value;
}
