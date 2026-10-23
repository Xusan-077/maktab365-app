// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import uz from "@/lib/i18n/messages/uz.json";
import type { AdminStats } from "@/lib/admin/types";

const api = vi.hoisted(() => ({ stats: vi.fn() }));
vi.mock("@/lib/admin/api", () => ({ getAdminApi: () => api }));
vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import { StatsView } from "./StatsView";

const t = uz.admin.stats;
const data = (over: Partial<AdminStats> = {}): AdminStats => ({
  days: 7,
  totals: { opens: 12, downloads: 3 },
  books: [
    {
      id: "b1",
      slug: "9-sinf-algebra",
      grade: 9,
      title: { uz: "Algebra" },
      opens: 12,
      downloads: 3,
    },
  ],
  daily: [
    { day: "2026-10-22", opens: 5, downloads: 1 },
    { day: "2026-10-23", opens: 7, downloads: 2 },
  ],
  top_pages: [
    {
      book_id: "b1",
      slug: "9-sinf-algebra",
      grade: 9,
      title: { uz: "Algebra" },
      page: 14,
      views: 8,
    },
  ],
  ...over,
});

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <NextIntlClientProvider locale="uz" messages={uz}>
      <QueryClientProvider client={client}>
        <StatsView />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => api.stats.mockReset().mockResolvedValue(data()));
afterEach(cleanup);

describe("StatsView", () => {
  it("jami sonlar, kitoblar va eng ko'p o'qilgan betlarni ko'rsatadi", async () => {
    setup();
    expect((await screen.findByTestId("stats-totals")).textContent).toContain("12");
    expect(screen.getByTestId("stats-books").textContent).toContain("Algebra");
    expect(screen.getByTestId("stats-pages").textContent).toContain("14");
    expect(api.stats).toHaveBeenCalledWith(7);
  });

  it("30 kunlik davrni tanlash yangi so'rov yuboradi", async () => {
    setup();
    await screen.findByTestId("stats-totals");
    fireEvent.click(screen.getByRole("button", { name: t.lastDays.replace("{days}", "30") }));
    await waitFor(() => expect(api.stats).toHaveBeenCalledWith(30));
  });

  it("ma'lumot bo'lmasa bo'sh holat", async () => {
    api.stats.mockResolvedValue(
      data({ totals: { opens: 0, downloads: 0 }, books: [], top_pages: [] }),
    );
    setup();
    expect(await screen.findByText(t.empty)).toBeTruthy();
  });
});
