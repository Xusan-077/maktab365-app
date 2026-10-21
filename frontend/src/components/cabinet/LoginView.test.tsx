// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import uz from "@/lib/i18n/messages/uz.json";

const { signIn, completeSignIn, requestOtp, push, search } = vi.hoisted(() => ({
  signIn: vi.fn(),
  completeSignIn: vi.fn(),
  requestOtp: vi.fn(),
  push: vi.fn(),
  search: { current: "" },
}));

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(search.current) }));
vi.mock("next-auth/react", () => ({ signIn }));
vi.mock("@/hooks/useCompleteSignIn", () => ({ useCompleteSignIn: () => completeSignIn }));
vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({ href, children, className }: { href: string; children: string; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
  useRouter: () => ({ push }),
}));
vi.mock("@/lib/auth/client", () => ({
  authClient: { requestOtp },
  errorCodeOf: (error: { code?: string }) => error.code ?? "unknown",
}));

import { LoginView } from "./LoginView";

function setup(query = "") {
  search.current = query;
  render(
    <NextIntlClientProvider locale="uz" messages={uz}>
      <LoginView />
    </NextIntlClientProvider>,
  );
  return userEvent.setup();
}

const continueToPassword = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByLabelText("Email"), "ali@example.com");
  await user.click(screen.getByRole("button", { name: "Davom etish" }));
};

beforeEach(() => {
  for (const mock of [signIn, completeSignIn, requestOtp, push]) mock.mockReset();
});
afterEach(cleanup);

describe("LoginView", () => {
  it("1-qadam: Google, email, ro'yxatdan o'tish va mehmon havolalari; tab ham, parol ham yo'q", () => {
    setup();
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.getByRole("button", { name: "Google bilan davom etish" })).toBeTruthy();
    expect(screen.getByLabelText("Email")).toBeTruthy();
    expect(screen.queryByLabelText("Parol")).toBeNull();
    expect(screen.getByRole("link", { name: "Ro'yxatdan o'ting" }).getAttribute("href")).toBe(
      "/royxatdan-otish",
    );
    expect(screen.getByRole("link", { name: "Kirmasdan davom etish" })).toBeTruthy();
  });

  it("noto'g'ri email 2-qadamga o'tkazmaydi", async () => {
    const user = setup();
    await user.type(screen.getByLabelText("Email"), "ali");
    await user.click(screen.getByRole("button", { name: "Davom etish" }));
    expect(screen.getByText(/Email manzili noto'g'ri/)).toBeTruthy();
    expect(screen.queryByLabelText("Parol")).toBeNull();
  });

  it("2-qadam backend'ga hech narsa yubormaydi: email matn, parol, parolsiz va unutdim", async () => {
    const user = setup();
    await continueToPassword(user);

    expect(screen.getByTestId("login-email").textContent).toBe("ali@example.com");
    expect(screen.getByLabelText("Parol")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Kirish" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Parolsiz: kodni emailga yuborish" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Parolni unutdingizmi?" })).toBeTruthy();
    expect(signIn).not.toHaveBeenCalled();
    expect(requestOtp).not.toHaveBeenCalled();
  });

  it("'Boshqa email' 1-qadamga qaytaradi, email saqlanadi", async () => {
    const user = setup();
    await continueToPassword(user);
    await user.click(screen.getByRole("button", { name: "Boshqa email" }));
    expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe("ali@example.com");
  });

  it("noto'g'ri parol: xabar forma ustida, forma o'z joyida", async () => {
    signIn.mockResolvedValue({ error: "CredentialsSignin", code: "invalid_credentials" });
    const user = setup();
    await continueToPassword(user);
    await user.type(screen.getByLabelText("Parol"), "notogri-parol-1");
    await user.click(screen.getByRole("button", { name: "Kirish" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Email yoki parol noto'g'ri.");
    expect(signIn).toHaveBeenCalledWith(
      "password",
      expect.objectContaining({ email: "ali@example.com", password: "notogri-parol-1" }),
    );
    expect(screen.getByLabelText("Parol")).toBeTruthy();
    expect(completeSignIn).not.toHaveBeenCalled();
  });

  it("to'g'ri parol kirishni yakunlaydi", async () => {
    signIn.mockResolvedValue({ error: undefined });
    const user = setup("callbackUrl=%2Fuz%2Fsozlamalar");
    await continueToPassword(user);
    await user.type(screen.getByLabelText("Parol"), "togri-parol-2026");
    await user.click(screen.getByRole("button", { name: "Kirish" }));
    await waitFor(() => expect(completeSignIn).toHaveBeenCalledWith("/uz/sozlamalar"));
  });

  it("parolsiz: kod so'raladi va /kod sahifasiga o'tiladi", async () => {
    requestOtp.mockResolvedValue(undefined);
    const user = setup();
    await continueToPassword(user);
    await user.click(screen.getByRole("button", { name: "Parolsiz: kodni emailga yuborish" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/kod?email=ali%40example.com"));
    expect(requestOtp).toHaveBeenCalledWith("ali@example.com", "uz");
  });

  it("parolsiz: throttle xatosi formada ko'rinadi, sahifa almashmaydi", async () => {
    requestOtp.mockRejectedValue({ code: "throttled" });
    const user = setup();
    await continueToPassword(user);
    await user.click(screen.getByRole("button", { name: "Parolsiz: kodni emailga yuborish" }));
    expect((await screen.findByRole("alert")).textContent).toContain("So'rovlar juda ko'p");
    expect(push).not.toHaveBeenCalled();
  });

  it("?authError= kodi tugmalar ustida xabar bo'lib chiqadi", () => {
    setup("authError=email_unverified_account");
    expect(screen.getByRole("alert").textContent).toContain("tasdiqlanmagan akkaunt");
    expect(screen.getByRole("button", { name: "Google bilan davom etish" })).toBeTruthy();
  });
});
