import type { components } from "./schema";
import type { StudyGoal, UpdateGoalInput } from "@/types/goal";
import type { Book, BookFilters, Chapter, Grade, Subject } from "@/types/catalog";
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

/** Backend bilan shartnoma. Hozir `MockApi`, keyin DRF uchun `HttpApi` shu interfeysni amalga oshiradi. */
export interface MaktabApi {
  /** Backend holati (DB va Redis). Mock rejimida doim "ok". */
  health(): Promise<HealthStatus>;
  getGrades(): Promise<Grade[]>;
  getSubjects(): Promise<Subject[]>;
  getBooks(filters?: BookFilters): Promise<Book[]>;
  getBook(bookId: string): Promise<Book>;
  getChapters(bookId: string): Promise<Chapter[]>;
  getTopic(topicId: string): Promise<Topic>;
  searchTopics(query: string, filters?: TopicSearchFilters): Promise<TopicSearchResult[]>;
  getProgress(filters?: ProgressFilters): Promise<Progress[]>;
  /** Idempotent va monoton: holat pasaymaydi, takror yuborish xavfsiz (oflayn navbat uchun). */
  saveProgress(input: SaveProgressInput): Promise<Progress>;
  /** Mavzu ochilganini yozadi ("yaqinda ochilganlar"); takror yuborish xavfsiz. */
  recordTopicOpened(topicId: string): Promise<void>;
  /** Oxirgi ochilgan mavzular, eng yangisi birinchi. */
  getRecent(): Promise<RecentTopic[]>;
  /** Kabinet bosh sahifasi: davom ettirish, fanlar, takrorlash kerak, haftalik natija. */
  getDashboard(): Promise<Dashboard>;
  /** "Natijalar": mavzu kesimida (o'zlashtirilgan / takrorlash kerak / jarayonda). */
  getResults(): Promise<Results>;
  /** O'qituvchi bosh sahifasi: yaqinda ochilgan va saqlangan materiallar. */
  getTeacherDashboard(): Promise<TeacherDashboard>;
  /** Mehmon ma'lumotini akkauntga qo'shadi. Idempotent: takror chaqirish hech narsani o'zgartirmaydi. */
  mergeGuestData(data: GuestData): Promise<MergeResult>;
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
  /** Faqat rolni almashtiradi (o'quvchi ↔ o'qituvchi); profil maydonlari saqlanadi. */
  setRole(role: UserRole): Promise<User>;
  /** Akkauntni o'chiradi: shaxsiy ma'lumotlar anonimlashtiriladi. Keyin klient chiqib ketishi kerak. */
  deleteAccount(): Promise<void>;
  /** Foydalanuvchining barcha ma'lumotlari (yuklab olish uchun). */
  exportData(): Promise<AccountExport>;
  /** O'qish rejasi (o'quvchining shaxsiy maqsadlari), eng yangisi birinchi. */
  getGoals(): Promise<StudyGoal[]>;
  createGoal(title: string): Promise<StudyGoal>;
  updateGoal(goalId: string, input: UpdateGoalInput): Promise<StudyGoal>;
  deleteGoal(goalId: string): Promise<void>;
  /** "Yordam va aloqa": savol, taklif yoki xatolik haqida murojaat (mehmon ham yubora oladi). */
  sendSupport(input: SupportInput): Promise<void>;
  /** Kirgan foydalanuvchining o'z murojaatlari va ularning holati, eng yangisi birinchi. */
  getMySupport(): Promise<SupportMessage[]>;
}

export type ApiMode = "mock" | "http";

/** Backend xato formati: `{ code, message, details? }` (ildiz CLAUDE.md). */
export type ApiErrorBody = {
  code: string;
  message: string;
  details?: Record<string, string[]>;
};

export type HealthStatus = components["schemas"]["Health"];

export type ApiErrorOptions = {
  code?: string;
  details?: ApiErrorBody["details"];
  requestId?: string;
};

export class ApiError extends Error {
  /** Mashina o'qiydigan barqaror kalit (`validation_error`, `not_found`…); tarmoq xatosida `network_error`/`timeout`. */
  readonly code: string;
  readonly details?: ApiErrorBody["details"];
  readonly requestId?: string;

  constructor(
    message: string,
    readonly status: number,
    options: ApiErrorOptions = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.code = options.code ?? "unknown";
    this.details = options.details;
    this.requestId = options.requestId;
  }
}
