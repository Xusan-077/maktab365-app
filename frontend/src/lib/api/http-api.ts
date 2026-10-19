import { createHttpClient, toApiError, unwrap, type HttpClient } from "./http-client";
import { toOnboardedUser, toOnboardingRequest, toProfileUpdateRequest, toUser } from "./mappers";
import { ApiError, type HealthStatus, type MaktabApi } from "./types";
import type { AccountExport, ProfileInput, UpdateProfileInput, User, UserRole } from "@/types/user";

const notImplemented = (method: string) => async (): Promise<never> => {
  throw new ApiError(`HttpApi.${method} keyingi bosqichda yoziladi`, 501, {
    code: "not_implemented",
  });
};

/** DRF klienti. Endpoint'lar tayyor bo'lganda har bir metod haqiqiy so'rovga almashtiriladi. */
export class HttpApi implements MaktabApi {
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

  getGrades = notImplemented("getGrades");
  getSubjects = notImplemented("getSubjects");
  getBooks = notImplemented("getBooks");
  getBook = notImplemented("getBook");
  getChapters = notImplemented("getChapters");
  getTopic = notImplemented("getTopic");
  searchTopics = notImplemented("searchTopics");
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
  submitFeedback = notImplemented("submitFeedback");
}

function isHealth(value: unknown): value is HealthStatus {
  return typeof value === "object" && value !== null && "status" in value && "checks" in value;
}
