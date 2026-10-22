// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import uz from "@/lib/i18n/messages/uz.json";

const api = vi.hoisted(() => ({
  library: vi.fn(),
  bookmarks: vi.fn(),
  allProgress: vi.fn(),
}));

vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ signedIn: true, status: "authenticated" }),
}));
vi.mock("@/hooks/useMe", () => ({
  useMe: () => ({ data: { role: "student", name: "Aziza", grade: 7 } }),
}));
vi.mock("@/hooks/usePdfProgressMap", () => ({ usePdfProgressMap: () => ({}) }));
vi.mock("@/lib/pdf-books/api", () => ({ getPdfBooksApi: () => api, PDF_PAGE_SIZE: 24 }));

import { LibraryHome } from "./LibraryHome";

const t = uz.library;
const book = (id: string, title: string, pages = 100) => ({
  id,
  title: { uz: title },
  grade: 9,
  subject: "algebra",
  subject_title: { uz: "Algebra" },
  page_count: pages,
  size_bytes: 1,
  cover: null,
  unverified: false,
  published_at: null,
});

function setup(base: "kabinet" | "ustoz" = "kabinet") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <NextIntlClientProvider locale="uz" messages={uz}>
      <QueryClientProvider client={client}>
        <LibraryHome base={base} />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.bookmarks.mockResolvedValue([]);
});
afterEach(cleanup);

describe("LibraryHome", () => {
  it("oxirgi kitob 'Davom ettirish' kartochkasida, aynan o'sha betga olib boradi", async () => {
    api.library.mockResolvedValue({
      items: [
        { book: book("b1", "Algebra 9"), last_page: 12, updated_at: "2026-01-02T00:00:00Z" },
        { book: book("b2", "Geometriya 9"), last_page: 3, updated_at: "2026-01-01T00:00:00Z" },
      ],
      saved_count: 0,
    });
    setup();

    const card = await screen.findByTestId("continue-card");
    expect(card.textContent).toContain("Algebra 9");
    expect(card.textContent).toContain("12 / 100-bet");
    const action = screen.getByRole("link", { name: /Algebra 9/ });
    expect(action.getAttribute("href")).toBe("/darsliklar/b1?page=12");
    // Qolgan ochilganlar "Oxirgi ochilganlar" ro'yxatida
    expect(await screen.findByText("Geometriya 9")).toBeTruthy();
  });

  it("hech narsa ochilmagan bo'lsa katalogga (o'quvchi sinfi bilan) taklif qiladi", async () => {
    api.library.mockResolvedValue({ items: [], saved_count: 0 });
    setup();

    expect(await screen.findByText(t.continue.emptyTitle)).toBeTruthy();
    const link = screen.getByRole("link", { name: t.continue.browse });
    expect(link.getAttribute("href")).toBe("/darsliklar?grade=7");
    expect(screen.queryByTestId("continue-card")).toBeNull();
  });

  it("saqlanganlar paneli saqlangan kitoblarni ko'rsatadi", async () => {
    api.library.mockResolvedValue({ items: [], saved_count: 1 });
    api.bookmarks.mockResolvedValue([
      { book: book("b3", "Fizika 9"), created_at: "2026-01-01T00:00:00Z" },
    ]);
    setup("ustoz");

    expect(await screen.findByTestId("saved-books")).toBeTruthy();
    expect(screen.getByText("Fizika 9")).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Salom/ })).toBeTruthy();
  });

  it("yuklash xatosida xabar chiqadi", async () => {
    api.library.mockRejectedValue(new Error("boom"));
    setup();

    expect(await screen.findByText(t.loadFailed)).toBeTruthy();
  });
});
