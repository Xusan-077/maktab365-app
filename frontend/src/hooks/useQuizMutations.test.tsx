// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/types";
import { quizKeys } from "@/lib/quizzes/queries";
import type { QuizSummary } from "@/lib/quizzes/types";

const api = vi.hoisted(() => ({ remove: vi.fn(), duplicate: vi.fn() }));
vi.mock("@/lib/quizzes/api", () => ({ getQuizzesApi: () => api }));

import { isTempQuiz, useDeleteQuiz, useDuplicateQuiz } from "./useQuizMutations";

const quiz = (id: string, title: string): QuizSummary => ({
  id,
  title,
  description: "",
  category: null,
  cover_url: null,
  visibility: "public",
  time_per_question: null,
  shuffle_questions: false,
  shuffle_options: false,
  question_count: 3,
  attempts_count: 2,
  best_percent: 66,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
});

const KEY = quizKeys.list({});
const serverError = () => new ApiError("xato", 502, { code: "network_error" });

function deferred<T = never>() {
  let reject: (error: unknown) => void = () => undefined;
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setup<T>(hook: () => T) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(KEY, [quiz("a", "Birinchi"), quiz("b", "Ikkinchi")]);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, ...renderHook(hook, { wrapper }) };
}

const titles = (client: QueryClient) =>
  (client.getQueryData<QuizSummary[]>(KEY) ?? []).map((item) => item.title);

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("useDeleteQuiz", () => {
  it("karta darrov yo'qoladi, xatoda qaytadi", async () => {
    const pending = deferred();
    api.remove.mockReturnValue(pending.promise);
    const { result, client } = setup(() => useDeleteQuiz());

    act(() => result.current.mutate("a"));
    await waitFor(() => expect(titles(client)).toEqual(["Ikkinchi"]));

    await act(async () => pending.reject(serverError()));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(titles(client)).toEqual(["Birinchi", "Ikkinchi"]);
  });

  it("muvaffaqiyatda karta yo'qolgan holda qoladi", async () => {
    api.remove.mockResolvedValue(undefined);
    const { result, client } = setup(() => useDeleteQuiz());
    await act(async () => result.current.mutate("a"));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(titles(client)).not.toContain("Birinchi");
  });
});

describe("useDuplicateQuiz", () => {
  it("vaqtinchalik nusxa ro'yxat boshida, xatoda olib tashlanadi", async () => {
    const pending = deferred();
    api.duplicate.mockReturnValue(pending.promise);
    const { result, client } = setup(() => useDuplicateQuiz((title) => `${title} (nusxa)`));

    act(() => result.current.mutate(quiz("a", "Birinchi")));
    await waitFor(() => expect(titles(client)[0]).toBe("Birinchi (nusxa)"));
    const temp = client.getQueryData<QuizSummary[]>(KEY)![0];
    expect(isTempQuiz(temp.id)).toBe(true);
    expect(temp).toMatchObject({ visibility: "private", attempts_count: 0, best_percent: null });

    await act(async () => pending.reject(serverError()));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(titles(client)).toEqual(["Birinchi", "Ikkinchi"]);
  });
});
