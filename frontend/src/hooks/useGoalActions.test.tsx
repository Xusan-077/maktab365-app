// @vitest-environment jsdom
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryKeys } from "@/lib/api/query-keys";
import { ApiError } from "@/lib/api/types";
import type { StudyGoal } from "@/types/goal";

const api = vi.hoisted(() => ({
  createGoal: vi.fn(),
  updateGoal: vi.fn(),
  deleteGoal: vi.fn(),
}));
vi.mock("@/lib/api", () => ({ getApi: () => api }));

import { useGoalActions } from "./useGoalActions";

const goal = (id: string, patch: Partial<StudyGoal> = {}): StudyGoal => ({
  id,
  userId: "u",
  title: `Maqsad ${id}`,
  done: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  ...patch,
});

const SERVER = [goal("a"), goal("b")];

let queryClient: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);
const cached = () => queryClient.getQueryData<StudyGoal[]>(queryKeys.goals());

/** Serverdan javob kutib turadigan va keyin xato bilan tugaydigan so'rov. */
function deferred<T>() {
  let reject: (error: unknown) => void = () => {};
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.clearAllMocks();
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(queryKeys.goals(), SERVER);
});

describe("useGoalActions: optimistic o'zgarish va rollback", () => {
  it("bajarildi belgisi darhol ko'rinadi, server rad etsa qaytariladi", async () => {
    const request = deferred<StudyGoal>();
    api.updateGoal.mockReturnValue(request.promise);
    const { result } = renderHook(() => useGoalActions(), { wrapper });

    act(() => result.current.update.mutate({ id: "a", done: true }));
    await waitFor(() => expect(cached()?.[0].done).toBe(true));

    await act(async () => request.reject(new ApiError("server", 500)));
    await waitFor(() => expect(result.current.update.isError).toBe(true));
    expect(cached()).toEqual(SERVER);
  });

  it("yangi maqsad darhol ro'yxat boshiga qo'shiladi, xatoda olib tashlanadi", async () => {
    const request = deferred<StudyGoal>();
    api.createGoal.mockReturnValue(request.promise);
    const { result } = renderHook(() => useGoalActions(), { wrapper });

    act(() => result.current.create.mutate("  Yangi maqsad "));
    await waitFor(() => expect(cached()).toHaveLength(3));
    expect(cached()?.[0]).toMatchObject({ title: "Yangi maqsad", done: false });

    await act(async () => request.reject(new ApiError("tarmoq", 0, { code: "network_error" })));
    await waitFor(() => expect(result.current.create.isError).toBe(true));
    expect(cached()).toEqual(SERVER);
  });

  it("o'chirish darhol ro'yxatdan olib tashlaydi, xatoda qaytaradi", async () => {
    const request = deferred<void>();
    api.deleteGoal.mockReturnValue(request.promise);
    const { result } = renderHook(() => useGoalActions(), { wrapper });

    act(() => result.current.remove.mutate("a"));
    await waitFor(() => expect(cached()?.map((item) => item.id)).toEqual(["b"]));

    await act(async () => request.reject(new ApiError("topilmadi", 500)));
    await waitFor(() => expect(result.current.remove.isError).toBe(true));
    expect(cached()).toEqual(SERVER);
  });

  it("muvaffaqiyatda server qiymati bilan almashadi", async () => {
    api.updateGoal.mockResolvedValue(goal("a", { done: true }));
    const { result } = renderHook(() => useGoalActions(), { wrapper });
    queryClient.setQueryDefaults(queryKeys.goals(), {
      queryFn: () => Promise.resolve([goal("a", { done: true }), goal("b")]),
    });

    await act(async () => {
      await result.current.update.mutateAsync({ id: "a", done: true });
    });
    await waitFor(() => expect(cached()).toEqual([goal("a", { done: true }), goal("b")]));
  });
});
