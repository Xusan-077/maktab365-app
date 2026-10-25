// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import uz from "@/lib/i18n/messages/uz.json";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  requestOtp: vi.fn(),
  signIn: vi.fn(),
  query: "",
}));

vi.mock("next-auth/react", () => ({ signIn: mocks.signIn }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(mocks.query) }));
vi.mock("@/hooks/useCompleteSignIn", () => ({ useCompleteSignIn: () => vi.fn() }));
vi.mock("@/components/layout/LanguageSwitcher", () => ({ LanguageSwitcher: () => null }));
// Telegram bot paneli o'z testida (`TelegramLoginPanel.test.tsx`).
vi.mock("@/components/auth/TelegramLoginPanel", () => ({
  TelegramLoginPanel: () => <button type="button">Telegram</button>,
}));
vi.mock("@/components/auth/LoginForm", () => ({
  PasswordStep: ({ email }: { email: string }) => <div data-testid="password-step">{email}</div>,
}));
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
  Link: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/auth/client", () => ({
  authClient: { requestOtp: mocks.requestOtp },
  errorCodeOf: (error: { code?: string }) => error.code ?? "unknown",
}));

import { LoginView } from "./LoginView";

function setup() {
  render(
    <NextIntlClientProvider locale="uz" messages={uz}>
      <LoginView covers={[]} />
    </NextIntlClientProvider>,
  );
  return userEvent.setup();
}

const emailInput = () => screen.getByRole("textbox", { name: "Email" }) as HTMLInputElement;
/** Bo'sh `aria-live` hududlari doim DOM'da: matni borini olamiz. */
const alertText = () =>
  screen
    .getAllByRole("alert")
    .map((node) => node.textContent)
    .join("");
const sendCode = () => screen.getByRole("button", { name: /Kod yuborish/ });

beforeEach(() => {
  mocks.push.mockReset();
  mocks.requestOtp.mockReset();
  mocks.signIn.mockReset();
  mocks.query = "";
});
afterEach(cleanup);

describe("LoginView", () => {
  it("sarlavha, Google va email formasi bor; alohida ro'yxatdan o'tish havolasi yo'q", () => {
    setup();
    expect(screen.getByRole("heading", { level: 1, name: "Xush kelibsiz" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Google bilan davom etish" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /ro'yxatdan o'tish/i })).toBeNull();
    expect(
      screen.getAllByRole("link").some((link) => link.getAttribute("href") === "/royxatdan-otish"),
    ).toBe(false);
  });

  it("noto'g'ri email: xato input ostida, backend'ga so'rov ketmaydi", async () => {
    const user = setup();
    await user.type(emailInput(), "salom");
    await user.click(sendCode());
    await waitFor(() => expect(alertText()).not.toBe(""));
    expect(emailInput().getAttribute("aria-invalid")).toBe("true");
    expect(mocks.requestOtp).not.toHaveBeenCalled();
  });

  it("kod so'raydi va /kod sahifasiga email hamda callbackUrl bilan o'tadi", async () => {
    mocks.query = "callbackUrl=%2Fuz%2Fkabinet";
    mocks.requestOtp.mockResolvedValue({ ok: true });
    const user = setup();
    await user.type(emailInput(), "ali@example.com");
    await user.click(sendCode());
    await waitFor(() => expect(mocks.push).toHaveBeenCalled());
    expect(mocks.requestOtp).toHaveBeenCalledExactlyOnceWith("ali@example.com", "uz");
    expect(mocks.push).toHaveBeenCalledWith(
      "/kod?email=ali%40example.com&callbackUrl=%2Fuz%2Fkabinet",
    );
  });

  it("ochiq yo'naltirish: tashqi callbackUrl tashlanadi", async () => {
    mocks.query = "callbackUrl=https%3A%2F%2Fevil.example";
    mocks.requestOtp.mockResolvedValue({ ok: true });
    const user = setup();
    await user.type(emailInput(), "ali@example.com");
    await user.click(sendCode());
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/kod?email=ali%40example.com"));
  });

  it("cooldown ham kiritish sahifasiga o'tkazadi", async () => {
    mocks.requestOtp.mockRejectedValue({ code: "otp_cooldown" });
    const user = setup();
    await user.type(emailInput(), "ali@example.com");
    await user.click(sendCode());
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/kod?email=ali%40example.com"));
  });

  it("boshqa xato input ostida chiqadi va sahifa almashmaydi", async () => {
    mocks.requestOtp.mockRejectedValue({ code: "rate_limited" });
    const user = setup();
    await user.type(emailInput(), "ali@example.com");
    await user.click(sendCode());
    await waitFor(() => expect(alertText()).not.toBe(""));
    expect(mocks.push).not.toHaveBeenCalled();
    expect(sendCode().hasAttribute("disabled")).toBe(false);
  });

  it("email oldindan to'ldiriladi (?email=) va parolli kirishga o'tish mumkin", async () => {
    mocks.query = "email=ali%40example.com";
    const user = setup();
    expect(emailInput().value).toBe("ali@example.com");
    await user.click(screen.getByRole("button", { name: "Parol bilan kirish" }));
    expect(screen.getByTestId("password-step").textContent).toBe("ali@example.com");
  });
});
