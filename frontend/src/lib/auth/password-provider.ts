import { CredentialsSignin, type User } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { isLocale } from "@/lib/i18n/config";
import {
  clientInfoFrom,
  loginWithPassword,
  registerWithPassword,
  type RegisterInput,
} from "./backend";
import { PASSWORD_PROVIDER } from "./config";
import { accountClaims } from "./jwt-callback";
import { signInErrorCode } from "./sign-in-errors";
import { toBackendTokens } from "./tokens";

/** Klientga `signIn(...).code` sifatida boradigan xato kodi (i18n kaliti; maxfiy ma'lumotsiz). */
export class BackendSignInError extends CredentialsSignin {
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

const text = (value: unknown) => (typeof value === "string" ? value : "");

export const passwordProvider = Credentials({
  id: PASSWORD_PROVIDER,
  name: "Email",
  credentials: {
    email: {},
    password: {},
    mode: {},
    displayName: {},
    locale: {},
  },
  async authorize(credentials, request): Promise<User> {
    const email = text(credentials.email).trim();
    const password = text(credentials.password);
    if (!email || !password) throw new BackendSignInError("validation_error");
    const locale = text(credentials.locale);
    const info = clientInfoFrom(request.headers);

    try {
      const session =
        text(credentials.mode) === "register"
          ? await registerWithPassword(
              {
                email,
                password,
                displayName: text(credentials.displayName).trim() || undefined,
                locale: isLocale(locale) ? (locale as RegisterInput["locale"]) : undefined,
              },
              info,
            )
          : await loginWithPassword({ email, password }, info);
      const claims = accountClaims(session.user);
      return {
        id: session.user.id,
        name: claims.name,
        email: claims.email,
        backend: toBackendTokens(session),
        account: claims.account,
      };
    } catch (error) {
      throw new BackendSignInError(signInErrorCode(error));
    }
  },
});
