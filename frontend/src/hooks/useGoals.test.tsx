// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/types";

const api = vi.hoisted(() => ({
  goals: vi.fn(),
  createGoal: vi.fn(),
  updateGoal: vi.fn(),
  deleteGoal: vi.fn(),
  dashboard: vi.fn(),
}));

vi.mock("./useAuth", () => ({ useAuth: () => ({ signedIn: true, status: "authenticated" }) }));
vi.mock("@/lib/pdf-books/api", () => ({ getPdfBooksApi: () => api }));

import { useGoals } from "./useGoals";

const goal = (id: string, title: string, done = false) => ({
  id,
  title,
  book: null,
  due_date: null,
  done,
  done_at: done ? "2026-01-01T00:00:00Z" : null,
  created_at: "2026-01-01T00:00:00Z",
});
const rejected = () => new ApiError("rad", 400, { code: "validation_error" });

/** Javobni qo'lda boshqarish: optimistic oraliq holatni ko'rish uchun. */
function deferred() {
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<never>((_, fail) => (reject = fail));
  return { promise, reject };
}

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useGoals(), { wrapper });
}

beforeEach(() => {
  vi.clearAllMocks();
  api.goals.mockResolvedValue([goal("g1", "Algebra 1-bob")]);
});
afterEach(cleanup);

describe("useGoals", () => {
  it("optimistic: yangi reja server javobidan oldin ro'yxatda ko'rinadi", async () => {
    api.createGoal.mockReturnValue(new Promise(() => undefined));
    const { result } = setup();
    await waitFor(() => expect(result.current.goals).toHaveLength(1));

    act(() => result.current.create.mutate({ title: "Geometriya" }));

    await waitFor(() =>
      expect(result.current.goals.map((g) => g.title)).toEqual(["Geometriya", "Algebra 1-bob"]),
    );
  });

  it("rollback: yaratish rad etilsa vaqtinchalik reja yo'qoladi", async () => {
    api.createGoal.mockRejectedValue(rejected());
    api.goals.mockResolvedValue([goal("g1", "Algebra 1-bob")]);
    const { result } = setup();
    await waitFor(() => expect(result.current.goals).toHaveLength(1));

    act(() => result.current.create.mutate({ title: "Geometriya" }));

    await waitFor(() => expect(api.createGoal).toHaveBeenCalled());
    await waitFor(() => expect(result.current.goals.map((g) => g.id)).toEqual(["g1"]));
  });

  it("rollback: bajarildi belgisi rad etilsa reja ochiq holatiga qaytadi", async () => {
    const pending = deferred();
    api.updateGoal.mockReturnValue(pending.promise);
    const { result } = setup();
    await waitFor(() => expect(result.current.goals).toHaveLength(1));

    act(() => result.current.toggle.mutate({ id: "g1", done: true }));

    await waitFor(() => expect(result.current.goals[0]?.done).toBe(true)); // darhol
    await waitFor(() => expect(api.updateGoal).toHaveBeenCalledWith("g1", { done: true }));
    act(() => pending.reject(rejected()));
    await waitFor(() => expect(result.current.goals[0]?.done).toBe(false)); // qaytarildi
  });

  it("rollback: o'chirish rad etilsa reja ro'yxatga qaytadi", async () => {
    const pending = deferred();
    api.deleteGoal.mockReturnValue(pending.promise);
    const { result } = setup();
    await waitFor(() => expect(result.current.goals).toHaveLength(1));

    act(() => result.current.remove.mutate("g1"));

    await waitFor(() => expect(result.current.goals).toHaveLength(0)); // darhol
    act(() => pending.reject(rejected()));
    await waitFor(() => expect(result.current.goals.map((g) => g.id)).toEqual(["g1"])); // qaytarildi
  });
});
