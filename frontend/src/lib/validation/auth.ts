import { object, ref, string } from "yup";

/**
 * Xabar kalitlari `authForm.errors.*` ga mos; matnni forma tilga o'giradi.
 * Parol qoidalari backend validatorlarining klient tomondagi qismi (uzunlik, faqat raqam emas);
 * "juda oddiy" va "emailga o'xshash" tekshiruvlari backend'da, kodi bilan qaytadi.
 */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

const email = () =>
  string().trim().required("emailRequired").email("emailInvalid").max(254, "emailInvalid");

const newPassword = () =>
  string()
    .required("passwordRequired")
    .min(PASSWORD_MIN, "passwordTooShort")
    .max(PASSWORD_MAX, "passwordTooLong")
    .test("not-numeric", "passwordNumeric", (value) => !value || !/^\d+$/.test(value));

const confirm = (field: string) =>
  string()
    .required("passwordRequired")
    .oneOf([ref(field)], "passwordsMismatch");

export const loginSchema = object({
  email: email(),
  password: string().required("passwordRequired").max(PASSWORD_MAX, "passwordTooLong"),
});

export const registerSchema = object({
  email: email(),
  password: newPassword(),
  passwordConfirm: confirm("password"),
});

export const forgotPasswordSchema = object({ email: email() });

export const resetPasswordSchema = object({
  password: newPassword(),
  passwordConfirm: confirm("password"),
});

export const changePasswordSchema = object({
  currentPassword: string().required("currentPasswordRequired"),
  newPassword: newPassword(),
  passwordConfirm: confirm("newPassword"),
});

export type LoginValues = { email: string; password: string };
export type RegisterValues = { email: string; password: string; passwordConfirm: string };
export type ForgotPasswordValues = { email: string };
export type ResetPasswordValues = { password: string; passwordConfirm: string };
export type ChangePasswordValues = {
  currentPassword: string;
  newPassword: string;
  passwordConfirm: string;
};

/** Backend xato kodi qaysi maydonga tegishli (qolganlari forma ustida ko'rsatiladi). */
export function fieldOfErrorCode(code: string): "email" | "password" | "currentPassword" | null {
  if (code === "email_taken") return "email";
  if (code.startsWith("password_")) return "password";
  if (code === "invalid_password") return "currentPassword";
  return null;
}
