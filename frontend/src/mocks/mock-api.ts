import { getApiSession, type ApiSession } from "@/lib/api/session";
import { ApiError, type HealthStatus, type MaktabApi } from "@/lib/api/types";
import type { SupportInput, SupportMessage } from "@/types/support";
import type { AccountExport, ProfileInput, UpdateProfileInput, User, UserRole } from "@/types/user";

/** `MaktabApi` ning xotiradagi amalga oshirilishi (akkaunt va murojaat). Holat jarayon xotirasida turadi. */
export const MOCK_DB_STORAGE_KEY = "maktab365-mock-db";

/** Bitta akkauntning mock ma'lumotlari. */
interface AccountDb {
  user: User | null;
  support: SupportMessage[];
}

type MockStorage = Pick<Storage, "getItem" | "setItem">;

export interface MockApiOptions {
  latencyMs?: number;
  /** Joriy akkaunt (default: `setApiSession` orqali berilgan Auth.js sessiyasi). */
  session?: () => ApiSession | null;
  /** Akkaunt ma'lumotlari saqlanadigan joy (default: brauzerda localStorage, aks holda xotira). */
  storage?: MockStorage;
}

/** `MaktabApi` ning mock amalga oshirilishi. Akkaunt holati sessiya id'si bo'yicha saqlanadi. */
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
    const empty: AccountDb = { user: null, support: [] };
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
            pdf_progress: [],
            pdf_bookmarks: [],
            goals: [],
          },
        };
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
