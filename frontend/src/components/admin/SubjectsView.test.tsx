// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { ApiError } from "@/lib/api/types";
import uz from "@/lib/i18n/messages/uz.json";
import type { AdminSubject } from "@/lib/admin/types";

const api = vi.hoisted(() => ({
  subjects: vi.fn(),
  createSubject: vi.fn(),
  updateSubject: vi.fn(),
  deleteSubject: vi.fn(),
}));
const identity = vi.hoisted(() => ({ role: "admin" }));

vi.mock("@/lib/admin/api", () => ({ getAdminApi: () => api }));
vi.mock("./AdminRoleProvider", () => ({ useAdminIdentity: () => identity }));
vi.mock("@/hooks/useToast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

import { SubjectsView } from "./SubjectsView";

const t = uz.admin.subjects;
const subject = (slug: string, name: string, books: number, order: number) =>
  ({ id: `id-${slug}`, slug, title: { uz: name }, order, pdf_books_count: books }) as AdminSubject;
const SUBJECTS = [subject("algebra", "Algebra", 2, 2), subject("fizika", "Fizika", 0, 9)];

function setup(role = "admin") {
  identity.role = role;
  api.subjects.mockResolvedValue(SUBJECTS);
  api.createSubject.mockResolvedValue({});
  api.updateSubject.mockResolvedValue({});
  api.deleteSubject.mockResolvedValue(undefined);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <NextIntlClientProvider locale="uz" messages={uz}>
      <QueryClientProvider client={client}>
        <SubjectsView />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // jsdom'da native <dialog> usullari yo'q.
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
});
afterEach(cleanup);

const label = (template: string, name: string) => template.replace("{name}", name);

describe("SubjectsView", () => {
  it("fanlarni va kitoblar sonini ko'rsatadi", async () => {
    setup();
    const table = await screen.findByTestId("subjects-table");
    expect(table.textContent).toContain("Algebra");
    expect(table.textContent).toContain("fizika");
  });

  it("yangi fan: nomdan slug taklif qilinadi va tartib raqami oxiriga qo'yiladi", async () => {
    setup();
    await screen.findByTestId("subjects-table");
    fireEvent.click(screen.getByRole("button", { name: t.new }));
    fireEvent.change(await screen.findByLabelText(uz.admin.localized.uz), {
      target: { value: "Ona tili" },
    });
    fireEvent.click(screen.getByRole("button", { name: uz.admin.common.create }));

    await waitFor(() =>
      expect(api.createSubject).toHaveBeenCalledWith({
        slug: "ona-tili",
        title: { uz: "Ona tili" },
        order: 10,
      }),
    );
  });

  it("slug band bo'lsa maydon xatosi ko'rsatiladi", async () => {
    setup();
    api.createSubject.mockRejectedValue(
      new ApiError("x", 400, { code: "validation_error", details: { slug: ["slug_taken"] } }),
    );
    await screen.findByTestId("subjects-table");
    fireEvent.click(screen.getByRole("button", { name: t.new }));
    fireEvent.change(await screen.findByLabelText(uz.admin.localized.uz), {
      target: { value: "Algebra" },
    });
    fireEvent.click(screen.getByRole("button", { name: uz.admin.common.create }));

    expect(await screen.findByText(uz.admin.errors.fields.slug_taken)).toBeTruthy();
  });

  it("nomini tahrirlash faqat sarlavhani yuboradi (slug o'zgarmaydi)", async () => {
    setup();
    await screen.findByTestId("subjects-table");
    fireEvent.click(screen.getByRole("button", { name: label(t.editLabel, "Fizika") }));
    const field = await screen.findByLabelText(uz.admin.localized.uz);
    fireEvent.change(field, { target: { value: "Fizika 2" } });
    fireEvent.click(screen.getByRole("button", { name: uz.admin.common.save }));

    await waitFor(() =>
      expect(api.updateSubject).toHaveBeenCalledWith("id-fizika", { title: { uz: "Fizika 2" } }),
    );
  });

  it("kitobi bor fanni o'chirib bo'lmaydi, kitobsizini tasdiqlagach o'chiradi", async () => {
    setup();
    await screen.findByTestId("subjects-table");
    const withBooks = screen.getByRole("button", { name: t.hasBooks.replace("{count}", "2") });
    expect((withBooks as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: label(t.deleteLabel, "Fizika") }));
    fireEvent.click(await screen.findByRole("button", { name: uz.admin.common.delete }));
    await waitFor(() => expect(api.deleteSubject).toHaveBeenCalledWith("id-fizika"));
  });

  it("backend o'chirishni rad etsa (bog'liq yozuv) xato matni chiqadi", async () => {
    setup();
    api.deleteSubject.mockRejectedValue(new ApiError("x", 409, { code: "has_dependents" }));
    await screen.findByTestId("subjects-table");
    fireEvent.click(screen.getByRole("button", { name: label(t.deleteLabel, "Fizika") }));
    fireEvent.click(await screen.findByRole("button", { name: uz.admin.common.delete }));
    expect(await screen.findByText(uz.admin.errors.codes.has_dependents)).toBeTruthy();
  });

  it("editor o'chirish tugmasini ko'rmaydi", async () => {
    setup("editor");
    await screen.findByTestId("subjects-table");
    expect(screen.queryByRole("button", { name: label(t.deleteLabel, "Fizika") })).toBeNull();
    expect(screen.getByRole("button", { name: label(t.editLabel, "Fizika") })).toBeTruthy();
  });
});
