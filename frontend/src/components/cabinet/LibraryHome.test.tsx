// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import uz from "@/lib/i18n/messages/uz.json";

const api = vi.hoisted(() => ({
  dashboard: vi.fn(),
  teacherDashboard: vi.fn(),
  goals: vi.fn(),
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

const item = (b: ReturnType<typeof book>, last_page: number, read_status = "in_progress") => ({
  book: b,
  last_page,
  read_status,
  read_at: null,
  updated_at: "2026-01-01T00:00:00Z",
});

const dashboard = (over: Record<string, unknown> = {}) => ({
  continue: null,
  subjects: [],
  review: [],
  week: { opened: 0, read: 0 },
  saved_count: 0,
  open_goals: 0,
  ...over,
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
  api.goals.mockResolvedValue([]);
  api.allProgress.mockResolvedValue([]);
});
afterEach(cleanup);

describe("LibraryHome", () => {
  it("'Davom ettirish' kartochkasi oxirgi kitobning aynan o'sha betiga olib boradi", async () => {
    api.dashboard.mockResolvedValue(dashboard({ continue: item(book("b1", "Algebra 9"), 12) }));
    setup();

    const card = await screen.findByTestId("continue-card");
    expect(card.textContent).toContain("Algebra 9");
    expect(card.textContent).toContain("12 / 100-bet");
    const action = screen.getByRole("link", { name: /Algebra 9/ });
    expect(action.getAttribute("href")).toBe("/darsliklar/b1?page=12");
  });

  it("haftalik ko'rsatkichlar va saqlanganlar soni serverdan", async () => {
    api.dashboard.mockResolvedValue(
      dashboard({
        continue: item(book("b1", "Algebra 9"), 3),
        week: { opened: 4, read: 2 },
        saved_count: 5,
        open_goals: 1,
      }),
    );
    setup();

    expect((await screen.findByTestId("stat-week-opened")).textContent).toBe("4");
    expect(screen.getByTestId("stat-week-read").textContent).toBe("2");
    expect(screen.getByTestId("stat-saved").textContent).toBe("5");
    expect(screen.getByTestId("stat-goals").textContent).toBe("1");
  });

  it("'Takrorlash kerak' va 'Fanlarim' panellari dashboard javobidan chiziladi", async () => {
    api.dashboard.mockResolvedValue(
      dashboard({
        continue: item(book("b1", "Algebra 9"), 12),
        review: [item(book("b2", "Geometriya 9"), 30)],
        subjects: [
          {
            slug: "algebra",
            title: { uz: "Algebra" },
            icon: "",
            books_total: 4,
            books_opened: 2,
            books_read: 1,
          },
        ],
      }),
    );
    setup();

    const review = await screen.findByTestId("review-list");
    expect(review.textContent).toContain("Geometriya 9");
    expect(screen.getByText("1 / 4 o'qilgan")).toBeTruthy();
  });

  it("hech narsa ochilmagan bo'lsa katalogga (o'quvchi sinfi bilan) taklif qiladi", async () => {
    api.dashboard.mockResolvedValue(dashboard());
    setup();

    expect(await screen.findByText(t.continue.emptyTitle)).toBeTruthy();
    const link = screen.getByRole("link", { name: t.continue.browse });
    expect(link.getAttribute("href")).toBe("/darsliklar?grade=7");
    expect(screen.queryByTestId("continue-card")).toBeNull();
  });

  it("saqlanganlar paneli saqlangan kitoblarni ko'rsatadi (ustoz paneli)", async () => {
    api.teacherDashboard.mockResolvedValue({ ...dashboard({ saved_count: 1 }), grades: [] });
    api.bookmarks.mockResolvedValue([
      { book: book("b3", "Fizika 9"), created_at: "2026-01-01T00:00:00Z" },
    ]);
    setup("ustoz");

    expect(await screen.findByTestId("saved-books")).toBeTruthy();
    expect(screen.getByText("Fizika 9")).toBeTruthy();
    expect(screen.getByRole("heading", { name: /Salom/ })).toBeTruthy();
    expect(api.dashboard).not.toHaveBeenCalled(); // ustoz o'z endpoint'idan oladi
  });

  it("ustoz: sinflar bo'yicha qamrov teacher dashboard'dan", async () => {
    api.teacherDashboard.mockResolvedValue({
      ...dashboard({ continue: item(book("b1", "Algebra 9"), 2) }),
      grades: [{ grade: 9, books_total: 5, books_opened: 2 }],
    });
    setup("ustoz");

    const grades = await screen.findByTestId("grades-list");
    expect(grades.textContent).toContain("9-sinf");
    expect(grades.textContent).toContain("2 / 5 ochilgan");
  });

  it("yuklash xatosida xabar chiqadi", async () => {
    api.dashboard.mockRejectedValue(new Error("boom"));
    setup();

    expect(await screen.findByText(t.loadFailed)).toBeTruthy();
  });
});
