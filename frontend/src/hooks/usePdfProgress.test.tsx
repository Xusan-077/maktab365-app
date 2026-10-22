// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/types";
import { resetWriteQueues } from "@/lib/offline/pdf-write-queue";
import { pdfKeys } from "@/lib/pdf-books/queries";
import { usePdfGuestStore } from "@/stores/pdf-guest.store";

const auth = vi.hoisted(() => ({ signedIn: true }));
const api = vi.hoisted(() => ({
  myProgress: vi.fn(),
  saveProgress: vi.fn(),
  recordEvent: vi.fn(),
  addBookmark: vi.fn(),
  removeBookmark: vi.fn(),
}));

vi.mock("./useAuth", () => ({
  useAuth: () => ({
    signedIn: auth.signedIn,
    status: auth.signedIn ? "authenticated" : "unauthenticated",
    sessionUser: auth.signedIn ? { id: "user-1" } : null,
  }),
}));
vi.mock("@/lib/pdf-books/api", () => ({ getPdfBooksApi: () => api }));

import { usePdfProgress } from "./usePdfProgress";

const saved = (page: number) => ({
  pdf_book_id: "b1",
  last_page: page,
  read_status: "in_progress" as const,
  updated_at: "2026-01-01T00:00:00Z",
});

let client: QueryClient;

function setup(pageCount = 20) {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => usePdfProgress("b1", pageCount), { wrapper });
}

const flushDebounce = () => act(() => vi.advanceTimersByTimeAsync(800));

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.clearAllMocks();
  localStorage.clear();
  resetWriteQueues();
  auth.signedIn = true;
  usePdfGuestStore.setState({ positions: {}, bookmarks: [] });
  api.myProgress.mockResolvedValue(saved(3));
  api.saveProgress.mockResolvedValue(saved(9));
  api.recordEvent.mockResolvedValue(saved(1));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("usePdfProgress (kirgan foydalanuvchi)", () => {
  it("kitob ochilganda 'book_opened' hodisasi yuboriladi", async () => {
    setup();

    await waitFor(() => expect(api.recordEvent).toHaveBeenCalledWith("b1", "book_opened"));
  });

  it("sahifa debounce'dan keyin yozuvlar navbati orqali yuboriladi", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => result.current.record(9));
    expect(api.saveProgress).not.toHaveBeenCalled();
    await flushDebounce();

    await waitFor(() => expect(api.saveProgress).toHaveBeenCalledTimes(1));
    expect(api.saveProgress).toHaveBeenCalledWith("b1", 9, expect.any(String));
  });

  it("optimistic: yuborish tugamasdan keshdagi sahifa yangilanadi", async () => {
    api.saveProgress.mockReturnValue(new Promise(() => undefined));
    const { result } = setup();
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => result.current.record(9));
    await flushDebounce();

    await waitFor(() =>
      expect(client.getQueryData(pdfKeys.progress("b1"))).toMatchObject({ last_page: 9 }),
    );
  });

  it("oxirgi betga yetish keshda darhol 'o'qilgan' holatini beradi", async () => {
    api.saveProgress.mockReturnValue(new Promise(() => undefined));
    const { result } = setup(20);
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => result.current.record(20));
    await flushDebounce();

    await waitFor(() =>
      expect(client.getQueryData(pdfKeys.progress("b1"))).toMatchObject({
        last_page: 20,
        read_status: "read",
      }),
    );
  });

  it("rollback: server doimiy rad etsa kesh oldingi sahifaga qaytadi", async () => {
    api.saveProgress.mockRejectedValue(new ApiError("Topilmadi", 404, { code: "not_found" }));
    const { result } = setup();
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => result.current.record(9));
    await flushDebounce();

    await waitFor(() => expect(api.saveProgress).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(client.getQueryData(pdfKeys.progress("b1"))).toMatchObject({ last_page: 3 }),
    );
    expect(localStorage.getItem("maktab365-writes:user-1")).toBeNull(); // rad etilgan yozuv navbatda qolmaydi
  });

  it("offline: yozuv navbatda qoladi, kesh qaytarilmaydi", async () => {
    api.saveProgress.mockRejectedValue(new ApiError("offline", 0, { code: "network_error" }));
    const { result } = setup();
    await waitFor(() => expect(result.current.ready).toBe(true));

    act(() => result.current.record(9));
    await flushDebounce();

    await waitFor(() =>
      expect(localStorage.getItem("maktab365-writes:user-1")).toContain('"page":9'),
    );
    expect(client.getQueryData(pdfKeys.progress("b1"))).toMatchObject({ last_page: 9 });
  });
});

describe("usePdfProgress (mehmon)", () => {
  it("serverga hech narsa yubormaydi, pozitsiya brauzerda saqlanadi", async () => {
    auth.signedIn = false;
    const { result } = setup();

    act(() => result.current.record(6));
    await flushDebounce();

    expect(usePdfGuestStore.getState().positions["b1"]?.page).toBe(6);
    expect(api.saveProgress).not.toHaveBeenCalled();
    expect(api.recordEvent).not.toHaveBeenCalled();
  });
});
