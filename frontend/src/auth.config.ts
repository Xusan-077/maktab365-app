import { cookies, headers } from "next/headers";
import type { NextAuthConfig, Session } from "next-auth";
import Google from "next-auth/providers/google";
import {
  clientInfoFrom,
  fetchMe,
  loginWithGoogle,
  logoutBackend,
  refreshBackendTokens,
} from "@/lib/auth/backend";
import { backendJwt, type JwtDeps } from "@/lib/auth/jwt-callback";
import { passwordProvider } from "@/lib/auth/password-provider";
import { LOCALE_COOKIE_NAME } from "@/lib/i18n/config";
import { refreshOnce } from "@/lib/auth/refresh";
import {
  googleSignIn,
  localeOf,
  otpProvider,
  telegramBotProvider,
  telegramProvider,
} from "@/lib/auth/social-providers";

const jwtDeps: JwtDeps = {
  now: Date.now,
  refresh: (refresh) => refreshOnce(refresh, refreshBackendTokens),
  fetchMe,
};

/**
 * Auth.js sozlamasi, sessiya JWT cookie'da (DB yo'q). Login ixtiyoriy — faqat `src/proxy.ts` dagi
 * himoyalangan yo'llar sessiya talab qiladi.
 * Hamma kirish usuli backend JWT juftligiga olib keladi (u faqat shifrlangan cookie'da, brauzerga
 * chiqmaydi); sessiyada rol/onboarding/email tasdig'i:
 * - `password`, `telegram`, `telegram-bot`, `otp` — Credentials (backend `/auth/*` ga `authorize` ichida boradi);
 * - Google — OAuth, lekin `signIn` callback'ida `id_token` backend'ga almashtiriladi: Google'ning
 *   o'z sessiyasi/profili ishlatilmaydi.
 */
export const authConfig = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: { params: { prompt: "select_account" } },
    }),
    passwordProvider,
    telegramProvider,
    telegramBotProvider,
    otpProvider,
  ],
  session: { strategy: "jwt" },
  trustHost: true,
  callbacks: {
    signIn: ({ user, account }) =>
      googleSignIn(
        { user, account },
        {
          login: loginWithGoogle,
          info: async () => clientInfoFrom(await headers()),
          locale: async () => localeOf((await cookies()).get(LOCALE_COOKIE_NAME)?.value),
        },
      ),
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
          ...(token.account && {
            role: token.account.role,
            staff: token.account.staff,
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
