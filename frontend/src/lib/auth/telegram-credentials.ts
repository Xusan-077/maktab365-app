import type { TelegramUser } from "@/components/auth/TelegramLoginButton";

/** Telegram widget foydalanuvchisi → `signIn("telegram")` maydonlari (hammasi satr). */
export function telegramCredentials(user: TelegramUser, locale: string) {
  return Object.fromEntries(
    Object.entries({ ...user, locale })
      .filter(([, value]) => value !== undefined && value !== "")
      .map(([key, value]) => [key, String(value)]),
  );
}
