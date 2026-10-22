// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePdfGuestStore } from "@/stores/pdf-guest.store";

const auth = vi.hoisted(() => ({ signedIn: false }));
const api = vi.hoisted(() => ({
  bookmarks: vi.fn(),
  addBookmark: vi.fn(),
  removeBookmark: vi.fn(),
}));

vi.mock("./useAuth", () => ({ useAuth: () => ({ signedIn: auth.signedIn, status: "x" }) }));
vi.mock("@/lib/pdf-books/api", () => ({ getPdfBooksApi: () => api }));

import { usePdfBookmarks } from "./usePdfBookmarks";

const bookmark = (id: string) => ({ book: { id }, created_at: "2026-01-01T00:00:00Z" });

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => usePdfBookmarks(), { wrapper });
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  usePdfGuestStore.setState({ positions: {}, bookmarks: [] });
  api.bookmarks.mockResolvedValue([bookmark("b1")]);
  api.addBookmark.mockResolvedValue(bookmark("b2"));
  api.removeBookmark.mockResolvedValue(undefined);
});
afterEach(cleanup);

describe("usePdfBookmarks", () => {
  it("mehmon: xatcho'p brauzerda saqlanadi, serverga so'rov ketmaydi", () => {
    auth.signedIn = false;
    const { result } = setup();

    act(() => result.current.setSaved("b1", true));
    expect(result.current.isSaved("b1")).toBe(true);
    expect(usePdfGuestStore.getState().bookmarks).toEqual(["b1"]);

    act(() => result.current.setSaved("b1", false));
    expect(result.current.isSaved("b1")).toBe(false);
    expect(api.addBookmark).not.toHaveBeenCalled();
    expect(api.bookmarks).not.toHaveBeenCalled();
  });

  it("mehmon: takror saqlash ro'yxatni ko'paytirmaydi", () => {
    auth.signedIn = false;
    const { result } = setup();

    act(() => result.current.setSaved("b1", true));
    act(() => result.current.setSaved("b1", true));

    expect(usePdfGuestStore.getState().bookmarks).toEqual(["b1"]);
  });

  it("kirgan foydalanuvchi: ro'yxat serverdan, saqlash va olib tashlash API orqali", async () => {
    auth.signedIn = true;
    const { result } = setup();

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.isSaved("b1")).toBe(true);
    expect(result.current.isSaved("b2")).toBe(false);

    act(() => result.current.setSaved("b2", true));
    await waitFor(() => expect(api.addBookmark).toHaveBeenCalledWith("b2"));

    act(() => result.current.setSaved("b1", false));
    await waitFor(() => expect(api.removeBookmark).toHaveBeenCalledWith("b1"));
    expect(usePdfGuestStore.getState().bookmarks).toEqual([]);
  });
});
