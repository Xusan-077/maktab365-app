import type { NextAuthConfig, Session } from "next-auth";
import Google from "next-auth/providers/google";
import { fetchMe, logoutBackend, refreshBackendTokens } from "@/lib/auth/backend";
import { BACKEND_AUTH } from "@/lib/auth/config";
import { backendJwt, type JwtDeps } from "@/lib/auth/jwt-callback";
import { passwordProvider } from "@/lib/auth/password-provider";
import { refreshOnce } from "@/lib/auth/refresh";

const jwtDeps: JwtDeps = {
  now: Date.now,
  refresh: (refresh) => refreshOnce(refresh, refreshBackendTokens),
  fetchMe,
};

/**
 * Auth.js sozlamasi, sessiya JWT cookie'da (DB yo'q). Login ixtiyoriy — faqat `src/proxy.ts` dagi
 * himoyalangan yo'llar sessiya talab qiladi.
 * - Google — eski oqim (M4 da backend bilan ulanadi): rol va profil `MaktabApi` da.
 * - `password` (Credentials, `NEXT_PUBLIC_BACKEND_AUTH=true`) — backend JWT'lari cookie ichida,
 *   sessiyada rol/onboarding/email tasdig'i; tokenlar brauzerga chiqmaydi.
 */
export const authConfig = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    ...(BACKEND_AUTH ? [passwordProvider] : []),
  ],
  session: { strategy: "jwt" },
  trustHost: true,
  callbacks: {
    jwt: (params) => backendJwt(params, jwtDeps),
    session({ session, token }): Session {
      const { name, email, image } = session.user;
      return {
        ...session,
        user: {
          id: token.sub ?? session.user.id,
          name,
          email,
          image,
          // Faqat email+parol sessiyasida (Google'da `account` yo'q).
          ...(token.account && {
            role: token.account.role,
            onboarded: token.account.onboarded,
            emailVerified: token.account.emailVerified,
          }),
        },
      };
    },
  },
  events: {
    async signOut(message) {
      const refresh = "token" in message ? message.token?.backend?.refresh : undefined;
      if (refresh) await logoutBackend(refresh);
    },
  },
} satisfies NextAuthConfig;
