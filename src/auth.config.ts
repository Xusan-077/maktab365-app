import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Auth.js sozlamasi: faqat Google, sessiya JWT cookie'da (DB yo'q). Login ixtiyoriy —
 * faqat `src/proxy.ts` dagi himoyalangan yo'llar sessiya talab qiladi.
 * Rol va profil Auth.js'da emas, `MaktabApi` (mock/DRF) da saqlanadi.
 */
export const authConfig = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  session: { strategy: "jwt" },
  trustHost: true,
  callbacks: {
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
} satisfies NextAuthConfig;
