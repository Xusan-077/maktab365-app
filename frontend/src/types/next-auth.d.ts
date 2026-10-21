import type { DefaultSession } from "next-auth";
import type { AccountState, BackendTokens, PanelRole, StaffRole } from "@/lib/auth/tokens";

declare module "next-auth" {
  interface Session {
    /**
     * `role`, `onboarded`, `emailVerified` faqat email+parol (backend) sessiyasida bor;
     * Google (eski oqim) sessiyasida `undefined`.
     */
    user: {
      id: string;
      role?: PanelRole;
      /** Editor/admin; `null` — oddiy foydalanuvchi, `undefined` — eski sessiya. */
      staff?: StaffRole | null;
      onboarded?: boolean;
      emailVerified?: boolean;
    } & DefaultSession["user"];
  }

  /** Credentials `authorize` natijasi. */
  interface User {
    backend?: BackendTokens;
    account?: AccountState;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    /** Backend tokenlari — faqat shifrlangan cookie'da, klientga `session` orqali chiqmaydi. */
    backend?: BackendTokens;
    account?: AccountState;
    error?: "RefreshFailed";
  }
}
