// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import uz from "@/lib/i18n/messages/uz.json";

const { signIn, completeSignIn, requestOtp } = vi.hoisted(() => ({
  signIn: vi.fn(),
  completeSignIn: vi.fn(),
  requestOtp: vi.fn(),
}));

vi.mock("next-auth/react", () => ({ signIn }));
vi.mock("@/hooks/useCompleteSignIn", () => ({ useCompleteSignIn: () => completeSignIn }));
vi.mock("@/components/layout/Logo", () => ({ Logo: () => <span>logo</span> }));
vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    className,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/auth/client", () => ({
  authClient: { requestOtp },
  errorCodeOf: (error: { code?: string }) => error.code ?? "unknown",
}));

import { OtpView } from "./OtpView";

function setup(props: { email?: string; callbackUrl?: string } = { email: "ali@example.com" }) {
  render(
    <NextIntlClientProvider locale="uz" messages={uz}>
      <OtpView {...props} />
    </NextIntlClientProvider>,
  );
  return userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
}

/** Taymer har soniyada qayta rejalanadi (effect), shuning uchun soniyama-soniya o'tkaziladi. */
function tick(seconds: number) {
  for (let i = 0; i < seconds; i++) {
    act(() => {
      vi.advanceTimersByTime(1000);
    });
  }
}

const cells = () => screen.getAllByRole("textbox") as HTMLInputElement[];
const submitButton = () => screen.getByRole("button", { name: "Kirish" }) as HTMLButtonElement;

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  signIn.mockReset();
  completeSignIn.mockReset();
  requestOtp.mockReset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("OtpView", () => {
  it("email, 'O'zgartirish' havolasi va kataklar bor, birinchisiga fokus", () => {
    setup({ email: "ali@example.com", callbackUrl: "/uz/sozlamalar" });
    expect(screen.getByText(/ali@example\.com/)).toBeTruthy();
    const change = screen.getByRole("link", { name: "O'zgartirish" });
    expect(change.getAttribute("href")).toBe(
      "/kirish?email=ali%40example.com&callbackUrl=%2Fuz%2Fsozlamalar",
    );
    expect(screen.getByRole("group", { name: "Tasdiqlash kodi" })).toBeTruthy();
    expect(cells()).toHaveLength(6);
    expect(document.activeElement).toBe(cells()[0]);
  });

  it("email bo'lmasa tushuntirish va kirish sahifasiga havola", () => {
    setup({});
    expect(screen.getByRole("alert").textContent).toContain("Email ko'rsatilmagan");
    expect(
      screen.getAllByRole("link").some((link) => link.getAttribute("href") === "/kirish"),
    ).toBe(true);
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
  });

  it("'Kirish' tugmasi kod to'lguncha o'chiq, 6-raqamda avtomatik yuboriladi", async () => {
    signIn.mockResolvedValue({ error: null });
    const user = setup({ email: "ali@example.com", callbackUrl: "/uz/sozlamalar" });
    expect(submitButton().disabled).toBe(true);

    await user.keyboard("12345");
    expect(submitButton().disabled).toBe(true);
    expect(signIn).not.toHaveBeenCalled();

    await user.keyboard("6");
    await waitFor(() => expect(completeSignIn).toHaveBeenCalledWith("/uz/sozlamalar"));
    expect(signIn).toHaveBeenCalledExactlyOnceWith("otp", {
      redirect: false,
      email: "ali@example.com",
      code: "123456",
      locale: "uz",
    });
  });

  it("noto'g'ri kod: xabar kataklar ostida, kataklar tozalanadi, qayta fokus", async () => {
    signIn.mockResolvedValue({ error: "CredentialsSignin", code: "invalid_code" });
    const user = setup();
    await user.keyboard("000000");
    expect((await screen.findByRole("alert")).textContent).toContain("Kod noto'g'ri");
    expect(completeSignIn).not.toHaveBeenCalled();
    expect(cells().every((cell) => cell.value === "")).toBe(true);
    expect(document.activeElement).toBe(cells()[0]);
    expect(submitButton().disabled).toBe(true);
  });

  it("qayta yuborish 60 soniyali taymerdan keyin havolaga aylanadi", async () => {
    requestOtp.mockResolvedValue({ ok: true });
    const user = setup();
    expect(screen.getByTestId("resend-timer").textContent).toContain("1:00");
    expect(screen.queryByRole("button", { name: "Qayta yuborish" })).toBeNull();

    tick(18);
    expect(screen.getByTestId("resend-timer").textContent).toContain("0:42");

    tick(42);
    await user.click(screen.getByRole("button", { name: "Qayta yuborish" }));
    expect(requestOtp).toHaveBeenCalledExactlyOnceWith("ali@example.com", "uz");
    expect((await screen.findByRole("status")).textContent).toContain("Yangi kod yuborildi");
    // Taymer qayta boshlandi.
    expect(screen.getByTestId("resend-timer").textContent).toContain("1:00");
  });

  it("qayta so'rash xatosi (cooldown) tushunarli xabar bilan", async () => {
    requestOtp.mockRejectedValue({ code: "otp_cooldown" });
    const user = setup();
    tick(60);
    await user.click(screen.getByRole("button", { name: "Qayta yuborish" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Kod yaqinda yuborildi");
  });
});
