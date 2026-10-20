// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({ href, children, className }: { href: string; children: string; className?: string }) => (
    <a href={href} className={className}>
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
  it("email ko'rsatiladi, kataklar bor, birinchisiga fokus", () => {
    setup({ email: "ali@example.com" });
    expect(screen.getByText(/ali@example\.com/)).toBeTruthy();
    expect(cells()).toHaveLength(6);
    expect(document.activeElement).toBe(cells()[0]);
  });

  it("email bo'lmasa tushuntirish va kirish sahifasiga havola", () => {
    setup({});
    expect(screen.getByRole("alert").textContent).toContain("Email ko'rsatilmagan");
    expect(screen.getByRole("link").getAttribute("href")).toBe("/kirish");
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
  });

  it("6 raqam to'lishi bilan avtomatik yuboriladi va kirish yakunlanadi", async () => {
    signIn.mockResolvedValue({ error: null });
    const user = setup({ email: "ali@example.com", callbackUrl: "/uz/sozlamalar" });
    await user.keyboard("123456");
    await waitFor(() => expect(completeSignIn).toHaveBeenCalledWith("/uz/sozlamalar"));
    expect(signIn).toHaveBeenCalledExactlyOnceWith("otp", {
      redirect: false,
      email: "ali@example.com",
      code: "123456",
      locale: "uz",
    });
  });

  it("noto'g'ri kod: xabar, kataklar tozalanadi, qayta fokus", async () => {
    signIn.mockResolvedValue({ error: "CredentialsSignin", code: "invalid_code" });
    const user = setup();
    await user.keyboard("000000");
    expect((await screen.findByRole("alert")).textContent).toContain("Kod noto'g'ri");
    expect(completeSignIn).not.toHaveBeenCalled();
    expect(cells().every((cell) => cell.value === "")).toBe(true);
    expect(document.activeElement).toBe(cells()[0]);
  });

  it("qayta yuborish 60 soniyadan keyin yoqiladi va yangi kod so'raydi", async () => {
    requestOtp.mockResolvedValue({ ok: true });
    const user = setup();
    const resend = screen.getByRole("button", { name: /Qayta yuborish: 60 soniya/ });
    expect((resend as HTMLButtonElement).disabled).toBe(true);

    tick(30);
    expect(screen.getByRole("button", { name: /Qayta yuborish: 30 soniya/ })).toBeTruthy();

    tick(30);
    const ready = screen.getByRole("button", { name: "Kodni qayta yuborish" });
    expect((ready as HTMLButtonElement).disabled).toBe(false);

    await user.click(ready);
    expect(requestOtp).toHaveBeenCalledExactlyOnceWith("ali@example.com", "uz");
    expect((await screen.findByRole("status")).textContent).toContain("Yangi kod yuborildi");
    // Taymer qayta boshlandi.
    expect(screen.getByRole("button", { name: /Qayta yuborish: 60 soniya/ })).toBeTruthy();
  });

  it("qayta so'rash xatosi (cooldown) tushunarli xabar bilan", async () => {
    requestOtp.mockRejectedValue({ code: "otp_cooldown" });
    const user = setup();
    tick(60);
    fireEvent.click(screen.getByRole("button", { name: "Kodni qayta yuborish" }));
    await user.tab();
    expect((await screen.findByRole("alert")).textContent).toContain("Kod yaqinda yuborildi");
  });
});
