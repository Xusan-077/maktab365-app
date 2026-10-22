import { describe, expect, it } from "vitest";
import type { AnySchema } from "yup";
import {
  changePasswordSchema,
  fieldOfErrorCode,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "./auth";

const errors = async (schema: AnySchema, values: object) => {
  try {
    await schema.validate(values, { abortEarly: false });
    return [];
  } catch (error) {
    return (error as { errors: string[] }).errors;
  }
};

describe("loginSchema", () => {
  it("bo'sh maydonlar va noto'g'ri email", async () => {
    expect(await errors(loginSchema, { email: "", password: "" })).toEqual(
      expect.arrayContaining(["emailRequired", "passwordRequired"]),
    );
    expect(await errors(loginSchema, { email: "ali@", password: "x" })).toEqual(["emailInvalid"]);
  });

  it("kirishda parol uzunligi tekshirilmaydi (eski parollar)", async () => {
    expect(await errors(loginSchema, { email: " ali@example.com ", password: "x" })).toEqual([]);
  });
});

describe("registerSchema", () => {
  const strong = crypto.randomUUID();
  const valid = { email: "ali@example.com", password: strong, passwordConfirm: strong };

  it("to'g'ri qiymatlar o'tadi", async () => {
    expect(await errors(registerSchema, valid)).toEqual([]);
  });

  it.each([
    ["qisqa1", "passwordTooShort"],
    ["1234567890", "passwordNumeric"],
    ["x".repeat(129), "passwordTooLong"],
  ])("parol %s → %s", async (password, code) => {
    expect(
      await errors(registerSchema, { ...valid, password, passwordConfirm: password }),
    ).toContain(code);
  });

  it("parollar mos kelmasa", async () => {
    expect(await errors(registerSchema, { ...valid, passwordConfirm: `${strong}-boshqa` })).toEqual(
      ["passwordsMismatch"],
    );
  });
});

describe("boshqa formalar", () => {
  it("parolni unutdim: email kerak", async () => {
    expect(await errors(forgotPasswordSchema, { email: "" })).toEqual(["emailRequired"]);
  });

  it("parolni tiklash: yangi parol qoidalari va tasdiq", async () => {
    expect(await errors(resetPasswordSchema, { password: "short", passwordConfirm: "x" })).toEqual(
      expect.arrayContaining(["passwordTooShort", "passwordsMismatch"]),
    );
  });

  it("parolni almashtirish: hozirgi parol kerak, tasdiq yangi parolga mos", async () => {
    expect(
      await errors(changePasswordSchema, {
        currentPassword: "",
        newPassword: crypto.randomUUID(),
        passwordConfirm: crypto.randomUUID(),
      }),
    ).toEqual(expect.arrayContaining(["currentPasswordRequired", "passwordsMismatch"]));
  });
});

describe("fieldOfErrorCode", () => {
  it("backend kodlarini maydonga bog'laydi", () => {
    expect(fieldOfErrorCode("email_taken")).toBe("email");
    expect(fieldOfErrorCode("password_too_common")).toBe("password");
    expect(fieldOfErrorCode("invalid_password")).toBe("currentPassword");
    expect(fieldOfErrorCode("invalid_credentials")).toBeNull();
  });
});
