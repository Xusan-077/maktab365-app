// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import uz from "@/lib/i18n/messages/uz.json";

const api = vi.hoisted(() => ({ list: vi.fn() }));
const nav = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("@/lib/i18n/navigation", () => ({
  usePathname: () => "/kabinet",
  useRouter: () => ({ push: nav.push }),
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/pdf-books/api", () => ({ getPdfBooksApi: () => api, PDF_PAGE_SIZE: 24 }));
// jsdom'da native <dialog> usullari yo'q
beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
});

import { PanelSearch } from "./PanelSearch";

const t = uz.panel.search;
const hit = {
  id: "b1",
  title: { uz: "Algebra 9" },
  grade: 9,
  subject: "algebra",
  subject_title: { uz: "Algebra" },
};

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <NextIntlClientProvider locale="uz" messages={uz}>
      <QueryClientProvider client={client}>
        <PanelSearch />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: t.open }));
  return screen.getByLabelText(t.label);
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("PanelSearch", () => {
  it("2 harfdan oldin so'rov yubormaydi va maslahat ko'rsatadi", () => {
    const input = setup();

    fireEvent.change(input, { target: { value: "a" } });

    expect(screen.getByText(t.hint)).toBeTruthy();
    expect(api.list).not.toHaveBeenCalled();
  });

  it("nom bo'yicha darsliklarni topadi va o'qish sahifasiga havola beradi", async () => {
    api.list.mockResolvedValue({ count: 1, results: [hit] });
    const input = setup();

    fireEvent.change(input, { target: { value: "algebra" } });

    const link = await screen.findByRole("link", { name: /Algebra 9/ });
    expect(link.getAttribute("href")).toBe("/darsliklar/b1");
    expect(link.textContent).toContain("9-sinf · Algebra");
    expect(api.list).toHaveBeenCalledWith(expect.objectContaining({ q: "algebra" }));
  });

  it("Enter birinchi natijaga o'tkazadi", async () => {
    api.list.mockResolvedValue({ count: 1, results: [hit] });
    const input = setup();

    fireEvent.change(input, { target: { value: "algebra" } });
    await screen.findByRole("link", { name: /Algebra 9/ });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => expect(nav.push).toHaveBeenCalledWith("/darsliklar/b1"));
  });

  it("natija bo'lmasa shuni aytadi", async () => {
    api.list.mockResolvedValue({ count: 0, results: [] });
    const input = setup();

    fireEvent.change(input, { target: { value: "zzz" } });

    expect(await screen.findByText(t.empty.replace("{query}", "zzz"))).toBeTruthy();
  });
});
