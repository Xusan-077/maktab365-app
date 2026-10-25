// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import uz from "@/lib/i18n/messages/uz.json";
import { useAuthModalStore } from "@/stores/auth-modal.store";

const { getSession, signIn, push, refresh, session } = vi.hoisted(() => ({
  getSession: vi.fn(),
  signIn: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
  session: { status: "unauthenticated" as "authenticated" | "unauthenticated" | "loading" },
}));

vi.mock("next-auth/react", () => ({
  getSession,
  signIn,
  useSession: () => ({ data: null, status: session.status }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
// Panelning o'z holatlari `TelegramLoginPanel.test.tsx` da; bu yerda faqat "kirdi" signali.
vi.mock("./TelegramLoginPanel", () => ({
  TelegramLoginPanel: ({ onSignedIn }: { onSignedIn: () => void }) => (
    <button type="button" onClick={onSignedIn}>
      signed-in
    </button>
  ),
}));

import { useRequireAuth } from "@/hooks/useRequireAuth";
import { AuthModal } from "./AuthModal";

let mobile = false;

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
});

beforeEach(() => {
  mobile = false;
  window.matchMedia = ((query: string) => ({
    matches: query.includes("max-width") ? mobile : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  session.status = "unauthenticated";
  getSession.mockReset();
  signIn.mockReset();
  push.mockReset();
  refresh.mockReset();
  useAuthModalStore.setState({ open: false, reason: "default", onSuccess: null });
});

afterEach(cleanup);

function renderModal() {
  render(
    <NextIntlClientProvider locale="uz" messages={uz}>
      <AuthModal />
    </NextIntlClientProvider>,
  );
}

const dialog = () => document.querySelector("dialog") as HTMLDialogElement;

describe("AuthModal", () => {
  it("yopiq holatda ichki panel chizilmaydi (polling yo'q)", () => {
    renderModal();
    expect(screen.queryByTestId("auth-modal")).toBeNull();
  });

  it("desktopda markazda 420px karta, sababga mos izoh", async () => {
    renderModal();
    act(() => useAuthModalStore.getState().openModal({ reason: "note" }));
    expect(await screen.findByTestId("auth-modal")).toBeTruthy();
    expect(dialog().dataset.placement).toBe("center");
    expect(dialog().className).toContain("max-w-[420px]");
    expect(screen.getByText(uz.authModal.reason.note)).toBeTruthy();
    expect(screen.getByRole("link", { name: uz.authModal.otherMethods })).toBeTruthy();
  });

  it("Google tugmasi Telegram'dan oldin; bosilsa Google OAuth → onboarding", async () => {
    renderModal();
    act(() => useAuthModalStore.getState().openModal());
    const google = await screen.findByRole("button", { name: uz.authForm.google });
    const telegram = screen.getByRole("button", { name: "signed-in" });
    expect(
      google.compareDocumentPosition(telegram) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    await userEvent.click(google);
    expect(signIn).toHaveBeenCalledWith("google", { redirectTo: "/uz/onboarding" });
  });

  it("mobilda pastki sheet", async () => {
    mobile = true;
    renderModal();
    act(() => useAuthModalStore.getState().openModal());
    await screen.findByTestId("auth-modal");
    expect(dialog().dataset.placement).toBe("bottom");
  });

  it("kirgach: onboarding tugamagan bo'lsa /onboarding, kutilgan amal bajarilmaydi", async () => {
    getSession.mockResolvedValue({ user: { onboarded: false } });
    const onSuccess = vi.fn();
    renderModal();
    act(() => useAuthModalStore.getState().openModal({ onSuccess }));
    await userEvent.click(await screen.findByRole("button", { name: "signed-in" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/uz/onboarding"));
    expect(onSuccess).not.toHaveBeenCalled();
    expect(useAuthModalStore.getState().open).toBe(false);
  });

  it("kirgach: profili bor bo'lsa kutilgan amal bajariladi va oyna yopiladi", async () => {
    getSession.mockResolvedValue({ user: { onboarded: true } });
    const onSuccess = vi.fn();
    renderModal();
    act(() => useAuthModalStore.getState().openModal({ onSuccess }));
    await userEvent.click(await screen.findByRole("button", { name: "signed-in" }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(push).not.toHaveBeenCalled();
    expect(refresh).toHaveBeenCalled();
    expect(useAuthModalStore.getState().open).toBe(false);
  });
});

describe("useRequireAuth", () => {
  it("mehmon: amal bajarilmaydi, oyna sabab va amal bilan ochiladi", () => {
    const action = vi.fn();
    const { result } = renderHook(() => useRequireAuth());
    let allowed: boolean | undefined;
    act(() => {
      allowed = result.current(action, "result");
    });
    expect(allowed).toBe(false);
    expect(action).not.toHaveBeenCalled();
    const state = useAuthModalStore.getState();
    expect(state.open).toBe(true);
    expect(state.reason).toBe("result");
    state.onSuccess?.();
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("kirgan foydalanuvchi: amal darhol bajariladi, oyna ochilmaydi", () => {
    session.status = "authenticated";
    const action = vi.fn();
    const { result } = renderHook(() => useRequireAuth());
    expect(result.current(action)).toBe(true);
    expect(action).toHaveBeenCalledTimes(1);
    expect(useAuthModalStore.getState().open).toBe(false);
  });

  it("sessiya aniqlanmaguncha hech narsa qilinmaydi", () => {
    session.status = "loading";
    const action = vi.fn();
    const { result } = renderHook(() => useRequireAuth());
    expect(result.current(action)).toBe(false);
    expect(action).not.toHaveBeenCalled();
    expect(useAuthModalStore.getState().open).toBe(false);
  });
});
