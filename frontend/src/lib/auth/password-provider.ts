import type { User } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import {
  clientInfoFrom,
  loginWithPassword,
  registerWithPassword,
  type RegisterInput,
} from "./backend";
import { PASSWORD_PROVIDER } from "./config";
import { signInErrorCode } from "./sign-in-errors";
import { BackendSignInError, localeOf, text, userFromSession } from "./social-providers";

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
    const info = clientInfoFrom(request.headers);

    try {
      const session =
        text(credentials.mode) === "register"
          ? await registerWithPassword(
              {
                email,
                password,
                displayName: text(credentials.displayName).trim() || undefined,
                locale: localeOf(credentials.locale) as RegisterInput["locale"],
              },
              info,
            )
          : await loginWithPassword({ email, password }, info);
      return userFromSession(session);
    } catch (error) {
      throw new BackendSignInError(signInErrorCode(error));
    }
  },
});
