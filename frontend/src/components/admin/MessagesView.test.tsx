// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import type { AdminSupportMessage } from "@/lib/admin/types";
import uz from "@/lib/i18n/messages/uz.json";

const BOOK = "3f2b8c1e-5d4a-4c7e-9a10-0b6f1d2e3c4d";
const nav = vi.hoisted(() => ({ params: new URLSearchParams(), replace: vi.fn() }));
const api = vi.hoisted(() => ({
  supportMessages: vi.fn(),
  supportSummary: vi.fn(),
  updateSupportMessage: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useSearchParams: () => nav.params }));
vi.mock("@/lib/admin/api", () => ({ getAdminApi: () => api }));
vi.mock("@/lib/i18n/navigation", () => ({
  usePathname: () => "/admin/xabarlar",
  useRouter: () => ({ replace: nav.replace }),
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { MessagesView } from "./MessagesView";

const t = uz.admin.messages;

const message = (over: Partial<AdminSupportMessage> = {}): AdminSupportMessage => ({
  id: "m1",
  kind: "content_error",
  message: "45-betdagi formulada xato bor",
  status: "new",
  staff_note: "",
  name: "",
  email: "ali@example.com",
  user_email: null,
  pdf_book: { id: BOOK, slug: "9-sinf-algebra", grade: 9, title: { uz: "Algebra" } },
  page: 45,
  page_url: "",
  created_at: "2026-10-24T18:03:10Z",
  updated_at: "2026-10-24T18:03:10Z",
  ...over,
});

function setup(query = "", rows: AdminSupportMessage[] = [message()]) {
  nav.params = new URLSearchParams(query);
  api.supportMessages.mockResolvedValue({ count: rows.length, results: rows });
  api.supportSummary.mockResolvedValue({
    new: 1,
    books: [{ id: BOOK, title: { uz: "Algebra" }, grade: 9, count: 1 }],
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <NextIntlClientProvider locale="uz" messages={uz}>
      <QueryClientProvider client={client}>
        <MessagesView />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
});
afterEach(cleanup);

describe("MessagesView", () => {
  it("URL'dagi filtrlar so'rovga o'tadi", async () => {
    setup(`holat=in_progress&tur=content_error&kitob=${BOOK}&page=2`);
    await screen.findByTestId("message-card");
    expect(api.supportMessages).toHaveBeenCalledWith({
      page: 2,
      status: "in_progress",
      kind: "content_error",
      pdfBook: BOOK,
    });
  });

  it("xabarda kitob va bet: o'qish oynasi shu betda (yangi oynada) ochiladi", async () => {
    setup();
    const link = await screen.findByTestId("message-book-link");
    expect(link.getAttribute("href")).toBe("/darsliklar/9/9-sinf-algebra/oqish?page=45");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.textContent).toContain("Algebra, 9-sinf · 45-bet");
    expect(screen.getByText("24-okt, 23:03")).toBeTruthy();
    expect(screen.getByText("ali@example.com")).toBeTruthy();
  });

  it("kitobsiz xabarda havola yo'q; ro'yxat bo'sh bo'lsa bo'sh holat", async () => {
    setup("", [message({ pdf_book: null, page: null })]);
    await screen.findByTestId("message-card");
    expect(screen.queryByTestId("message-book-link")).toBeNull();
    cleanup();
    setup("", []);
    expect(await screen.findByText(t.empty)).toBeTruthy();
  });

  it("izoh yozilsa «Izohni saqlash» chiqadi va PATCH yuboriladi", async () => {
    api.updateSupportMessage.mockResolvedValue(message({ staff_note: "Tuzatildi" }));
    setup();
    await screen.findByTestId("message-card");
    expect(screen.queryByText(t.saveNote)).toBeNull();

    fireEvent.change(screen.getByLabelText(t.noteLabel), { target: { value: "  Tuzatildi " } });
    fireEvent.click(screen.getByText(t.saveNote));

    await waitFor(() =>
      expect(api.updateSupportMessage).toHaveBeenCalledWith("m1", { staff_note: "Tuzatildi" }),
    );
  });
});
