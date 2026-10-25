import { CredentialsSignin, type User } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { components } from "@/lib/api/schema";
import { isLocale } from "@/lib/i18n/config";
import {
  clientInfoFrom,
  completeTelegramLogin,
  loginWithOtp,
  loginWithTelegram,
  type ClientInfo,
  type loginWithGoogle,
} from "./backend";
import { OTP_PROVIDER, TELEGRAM_BOT_PROVIDER, TELEGRAM_PROVIDER } from "./config";
import { accountClaims } from "./jwt-callback";
import { signInErrorCode } from "./sign-in-errors";
import { readCookie, TELEGRAM_NONCE_COOKIE } from "./telegram-bot";
import { toBackendTokens } from "./tokens";

type AuthSession = components["schemas"]["AuthSession"];
type Locale = components["schemas"]["LocaleEnum"];

/** Klientga `signIn(...).code` sifatida boradigan xato kodi (i18n kaliti; maxfiy ma'lumotsiz). */
export class BackendSignInError extends CredentialsSignin {
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

export const text = (value: unknown) => (typeof value === "string" ? value : "");

export function localeOf(value: unknown): Locale | undefined {
  const locale = text(value);
  return isLocale(locale) ? (locale as Locale) : undefined;
}

/** Backend sessiyasi → Auth.js `User` (tokenlar va akkaunt holati `jwt` callback'iga o'tadi). */
export function userFromSession(session: AuthSession): User {
  const claims = accountClaims(session.user);
  return {
    id: session.user.id,
    name: claims.name,
    email: claims.email,
    backend: toBackendTokens(session),
    account: claims.account,
  };
}

/** Widget maydonlari: faqat berilganlari, `id` va `auth_date` son sifatida (imzo shu qiymatlar ustida). */
export function telegramBody(credentials: Partial<Record<string, unknown>>) {
  const optional = (key: string) => text(credentials[key]) || undefined;
  const lastName = optional("last_name");
  const username = optional("username");
  const photoUrl = optional("photo_url");
  const locale = localeOf(credentials.locale);
  return {
    id: Number(text(credentials.id)),
    first_name: text(credentials.first_name),
    ...(lastName && { last_name: lastName }),
    ...(username && { username }),
    ...(photoUrl && { photo_url: photoUrl }),
    auth_date: Number(text(credentials.auth_date)),
    hash: text(credentials.hash),
    ...(locale && { locale }),
  };
}

type Credentials = Partial<Record<string, unknown>>;

export async function authorizeTelegram(credentials: Credentials, headers: Headers): Promise<User> {
  const body = telegramBody(credentials);
  if (!Number.isSafeInteger(body.id) || !Number.isSafeInteger(body.auth_date) || !body.hash) {
    throw new BackendSignInError("provider_auth_invalid");
  }
  try {
    return userFromSession(await loginWithTelegram(body, clientInfoFrom(headers)));
  } catch (error) {
    throw new BackendSignInError(signInErrorCode(error));
  }
}

export async function authorizeOtp(credentials: Credentials, headers: Headers): Promise<User> {
  const email = text(credentials.email).trim();
  const code = text(credentials.code).trim();
  if (!email || !/^\d{6}$/.test(code)) throw new BackendSignInError("invalid_code");
  const locale = localeOf(credentials.locale);
  try {
    const session = await loginWithOtp(
      { email, code, ...(locale && { locale }) },
      clientInfoFrom(headers),
    );
    return userFromSession(session);
  } catch (error) {
    throw new BackendSignInError(signInErrorCode(error));
  }
}

/** Botda tasdiqlangan kirish: `token` brauzerdan, nonce — shu brauzerning httpOnly `tg_nonce` cookie'sidan. */
export async function authorizeTelegramBot(
  credentials: Credentials,
  headers: Headers,
): Promise<User> {
  const token = text(credentials.token);
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) throw new BackendSignInError("telegram_login_expired");
  const locale = localeOf(credentials.locale);
  try {
    const session = await completeTelegramLogin(
      { token, ...(locale && { locale }) },
      readCookie(headers, TELEGRAM_NONCE_COOKIE),
      clientInfoFrom(headers),
    );
    return userFromSession(session);
  } catch (error) {
    throw new BackendSignInError(signInErrorCode(error));
  }
}

export const telegramBotProvider = Credentials({
  id: TELEGRAM_BOT_PROVIDER,
  name: "Telegram bot",
  credentials: { token: {}, locale: {} },
  authorize: (credentials, request) => authorizeTelegramBot(credentials, request.headers),
});

export const telegramProvider = Credentials({
  id: TELEGRAM_PROVIDER,
  name: "Telegram",
  credentials: {
    id: {},
    first_name: {},
    last_name: {},
    username: {},
    photo_url: {},
    auth_date: {},
    hash: {},
    locale: {},
  },
  authorize: (credentials, request) => authorizeTelegram(credentials, request.headers),
});

export const otpProvider = Credentials({
  id: OTP_PROVIDER,
  name: "Email OTP",
  credentials: { email: {}, code: {}, locale: {} },
  authorize: (credentials, request) => authorizeOtp(credentials, request.headers),
});

export interface GoogleSignInParams {
  user: User;
  account?: { provider?: string; id_token?: string | null } | null;
}

export interface GoogleSignInDeps {
  login: typeof loginWithGoogle;
  info: () => ClientInfo | Promise<ClientInfo>;
  locale: () => Locale | undefined | Promise<Locale | undefined>;
}

/**
 * Auth.js `signIn` callback'i (Google): Google bergan `id_token` backend `/auth/google/` ga
 * almashtiriladi, sessiya backend JWT juftligi bilan quriladi. `true` — davom etish; satr —
 * kirish sahifasiga xato kodi bilan qaytarish (masalan, email boshqa tasdiqlanmagan akkauntda).
 */
export async function googleSignIn(
  { user, account }: GoogleSignInParams,
  deps: GoogleSignInDeps,
): Promise<boolean | string> {
  if (account?.provider !== "google") return true;
  const failure = (code: string) => `/kirish?${new URLSearchParams({ authError: code })}`;
  if (!account.id_token) return failure("provider_auth_invalid");
  try {
    const locale = await deps.locale();
    const session = await deps.login(
      { id_token: account.id_token, ...(locale && { locale }) },
      await deps.info(),
    );
    Object.assign(user, userFromSession(session));
    return true;
  } catch (error) {
    return failure(signInErrorCode(error));
  }
}
