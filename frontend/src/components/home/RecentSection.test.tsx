// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import uz from "@/lib/i18n/messages/uz.json";
import type { RecentBook } from "@/lib/pdf/recent";
import { RECENT_BOOKS_STORAGE_KEY, useRecentBooksStore } from "@/stores/recent-books.store";

const progress = vi.hoisted(() => ({ map: {} as Record<string, { page: number; status: null }> }));
vi.mock("@/hooks/usePdfProgressMap", () => ({
  usePdfProgressMap: () => progress.map,
  isBookRead: (entry: { page: number } | undefined, total: number) =>
    entry !== undefined && entry.page >= total,
}));
vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { RecentSection } from "./RecentSection";

const book = (id: string, pages = 100): RecentBook => ({
  id,
  slug: `9-sinf-${id}`,
  title: { uz: `Kitob ${id}` },
  grade: 9,
  subject: "algebra",
  subject_title: { uz: "Algebra" },
  subject_group: "exact",
  page_count: pages,
  size_bytes: 1024,
  cover: null,
  unverified: false,
  published_at: null,
});

function setup() {
  render(
    <NextIntlClientProvider locale="uz" messages={uz}>
      <RecentSection />
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  progress.map = {};
  useRecentBooksStore.setState({ items: [] });
});
afterEach(cleanup);

describe("RecentSection", () => {
  it("yozuv yo'q bo'lsa hech narsa chizilmaydi", async () => {
    setup();
    await waitFor(() => expect(useRecentBooksStore.persist.hasHydrated()).toBe(true));
    expect(screen.queryByText(uz.home.recent.title)).toBeNull();
  });

  it("tugatilmagan oxirgi kitob «Davom ettirish» bo'ladi, qolganlari ro'yxatda", async () => {
    localStorage.setItem(
      RECENT_BOOKS_STORAGE_KEY,
      JSON.stringify({ state: { items: [book("a"), book("b")] }, version: 0 }),
    );
    progress.map = { a: { page: 12, status: null } };
    setup();

    const card = await screen.findByTestId("home-resume");
    expect(card.textContent).toContain("Kitob a");
    const link = screen.getByRole("link", { name: uz.home.recent.resume });
    expect(link.getAttribute("href")).toBe("/darsliklar/9/9-sinf-a/oqish?page=12");
    expect(screen.getByRole("heading", { name: uz.home.recent.recent })).toBeTruthy();
    expect(screen.getAllByTestId("pdf-book-card")).toHaveLength(1);
  });

  it("oxirigacha o'qilgan kitob «Davom ettirish» bo'lmaydi", async () => {
    localStorage.setItem(
      RECENT_BOOKS_STORAGE_KEY,
      JSON.stringify({ state: { items: [book("a", 10)] }, version: 0 }),
    );
    progress.map = { a: { page: 10, status: null } };
    setup();
    await screen.findByText(uz.home.recent.title);
    expect(screen.queryByTestId("home-resume")).toBeNull();
  });
});
