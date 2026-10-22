import type { components } from "./schema";
import type { SupportInput, SupportMessage } from "@/types/support";
import type { AccountExport, ProfileInput, UpdateProfileInput, User, UserRole } from "@/types/user";

/** Backend bilan shartnoma: akkaunt va murojaat (katalog va o'qish — `lib/pdf-books`). */
export interface MaktabApi {
  /** Backend holati (DB va Redis). Mock rejimida doim "ok". */
  health(): Promise<HealthStatus>;
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
