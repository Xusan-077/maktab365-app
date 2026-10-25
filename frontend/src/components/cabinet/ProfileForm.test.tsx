// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import uz from "@/lib/i18n/messages/uz.json";

const { saveProfile, update, toast } = vi.hoisted(() => ({
  saveProfile: vi.fn(),
  update: vi.fn(),
  toast: vi.fn(),
}));

vi.mock("next-auth/react", () => ({ useSession: () => ({ update }) }));
vi.mock("@/lib/api", () => ({ getApi: () => ({ saveProfile }) }));
vi.mock("@/hooks/useToast", () => ({ useToast: () => ({ toast }) }));
vi.mock("@/lib/pdf-books/queries", () => ({
  pdfQueries: { subjects: () => ({ queryKey: ["subjects"], queryFn: async () => [] }) },
}));

import { ProfileForm } from "./ProfileForm";

const t = uz.onboarding;

function setup(defaultName = "") {
  const onSaved = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <NextIntlClientProvider locale="uz" messages={uz}>
        <ProfileForm defaultName={defaultName} submitLabel={t.submit} onSaved={onSaved} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  return { onSaved, user: userEvent.setup() };
}

const submit = () => screen.getByRole("button", { name: t.submit });
const gradeChip = (grade: number) => screen.getByRole("button", { name: `${grade}-sinf` });

beforeEach(() => {
  // Fanlar `MultiSelect` i (useMediaQuery) uchun: jsdom'da matchMedia yo'q.
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  saveProfile.mockReset().mockImplementation(async (input) => ({ ...input, id: "u-1" }));
  update.mockReset().mockResolvedValue(null);
  toast.mockReset();
});

afterEach(cleanup);

describe("ProfileForm (onboarding)", () => {
  it("1–11-sinf chip tugmalari", () => {
    setup();
    for (let grade = 1; grade <= 11; grade++) expect(gradeChip(grade)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "12-sinf" })).toBeNull();
  });

  it("bo'sh forma: ism va sinf xatolari, so'rov yuborilmaydi", async () => {
    const { user } = setup();
    await user.click(submit());
    expect(await screen.findByText(t.errors.nameRequired)).toBeTruthy();
    expect(screen.getByText(t.errors.gradeRequired)).toBeTruthy();
    expect(saveProfile).not.toHaveBeenCalled();
  });

  it("60 belgidan uzun ism rad etiladi", async () => {
    const { user } = setup("a".repeat(61));
    await user.click(gradeChip(7));
    await user.click(submit());
    expect(await screen.findByText(t.errors.nameTooLong)).toBeTruthy();
    expect(saveProfile).not.toHaveBeenCalled();
  });

  it("o'quvchi: ism + sinf chipi → saqlanadi va sessiya yangilanadi", async () => {
    const { user, onSaved } = setup("Vali");
    await user.click(gradeChip(7));
    expect(gradeChip(7).getAttribute("aria-pressed")).toBe("true");
    await user.click(submit());
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(saveProfile).toHaveBeenCalledWith({ role: "student", name: "Vali", grade: 7 });
    expect(update).toHaveBeenCalledWith({ refresh: "account" });
  });

  it("o'qituvchi: kamida bitta sinf va fan kerak; sinflar bir nechta tanlanadi", async () => {
    const { user } = setup("Ali");
    await user.click(screen.getByRole("radio", { name: new RegExp(t.roleTeacher) }));
    await user.click(submit());
    expect(await screen.findByText(t.errors.gradesRequired)).toBeTruthy();
    expect(screen.getByText(t.errors.subjectsRequired)).toBeTruthy();

    await user.click(gradeChip(9));
    await user.click(gradeChip(5));
    expect(gradeChip(9).getAttribute("aria-pressed")).toBe("true");
    expect(gradeChip(5).getAttribute("aria-pressed")).toBe("true");
    await user.click(gradeChip(9));
    expect(gradeChip(9).getAttribute("aria-pressed")).toBe("false");
  });
});
