import type { Feedback, FeedbackInput } from "@/types/feedback";
import type { StudyGoal, UpdateGoalInput } from "@/types/goal";
import type { Book, BookFilters, Chapter, Grade, Subject } from "@/types/catalog";
import type {
  BookBookmark,
  Bookmark,
  Progress,
  ProgressFilters,
  SaveProgressInput,
  ToggleBookBookmarkResult,
  ToggleBookmarkResult,
} from "@/types/progress";
import type { Topic, TopicSearchFilters, TopicSearchResult } from "@/types/topic";
import type { ProfileInput, UpdateProfileInput, User } from "@/types/user";

/** Backend bilan shartnoma. Hozir `MockApi`, keyin DRF uchun `HttpApi` shu interfeysni amalga oshiradi. */
export interface MaktabApi {
  getGrades(): Promise<Grade[]>;
  getSubjects(): Promise<Subject[]>;
  getBooks(filters?: BookFilters): Promise<Book[]>;
  getBook(bookId: string): Promise<Book>;
  getChapters(bookId: string): Promise<Chapter[]>;
  getTopic(topicId: string): Promise<Topic>;
  searchTopics(query: string, filters?: TopicSearchFilters): Promise<TopicSearchResult[]>;
  getProgress(filters?: ProgressFilters): Promise<Progress[]>;
  saveProgress(input: SaveProgressInput): Promise<Progress>;
  getBookmarks(): Promise<Bookmark[]>;
  toggleBookmark(topicId: string): Promise<ToggleBookmarkResult>;
  /** Xatcho'pni aniq holatga keltiradi (takror yuborilsa ham xavfsiz — oflayn navbat uchun). */
  setBookmark(topicId: string, bookmarked: boolean): Promise<ToggleBookmarkResult>;
  /** Saqlangan kitoblar (o'qituvchi materiallari). */
  getBookBookmarks(): Promise<BookBookmark[]>;
  toggleBookBookmark(bookId: string): Promise<ToggleBookBookmarkResult>;
  /** Kirmagan yoki profili (onboarding) hali to'ldirilmagan foydalanuvchi uchun `null`. */
  getMe(): Promise<User | null>;
  /** Profilni yaratadi yoki to'liq almashtiradi (rol ham o'zgarishi mumkin). */
  saveProfile(input: ProfileInput): Promise<User>;
  updateProfile(input: UpdateProfileInput): Promise<User>;
  /** O'qish rejasi (o'quvchining shaxsiy maqsadlari), eng yangisi birinchi. */
  getGoals(): Promise<StudyGoal[]>;
  createGoal(title: string): Promise<StudyGoal>;
  updateGoal(goalId: string, input: UpdateGoalInput): Promise<StudyGoal>;
  deleteGoal(goalId: string): Promise<void>;
  /** Panelning "Yordam" sahifasidan savol, taklif yoki xatolik haqida xabar yuboradi. */
  submitFeedback(input: FeedbackInput): Promise<Feedback>;
}

export type ApiMode = "mock" | "http";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
