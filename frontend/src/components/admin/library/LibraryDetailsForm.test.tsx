// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import uz from "@/lib/i18n/messages/uz.json";
import { appendBulkChapters, EMPTY_LIBRARY_BOOK } from "@/lib/validation/library-book";
import { LibraryDetailsForm } from "./LibraryDetailsForm";

vi.mock("@/lib/library/admin-queries", () => ({
  libraryQueries: {
    types: () => ({
      queryKey: ["library-types"],
      queryFn: async () => [{ id: "t1", name: { uz: "Darslik" }, is_active: true }],
    }),
  },
}));

const t = uz.admin.library.chapters;
const tb = uz.admin.toc.bulk;

type Submit = Parameters<typeof LibraryDetailsForm>[0]["onSubmit"];

function setup(onSubmit = vi.fn<Submit>(async () => undefined)) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="uz" messages={uz}>
        <LibraryDetailsForm
          initial={{ ...EMPTY_LIBRARY_BOOK, title: "Kitob", bookType: "t1" }}
          submitLabel="Saqlash"
          onSubmit={onSubmit}
        />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
  return onSubmit;
}

const titles = () =>
  screen.getAllByLabelText(t.titleLabel).map((input) => (input as HTMLInputElement).value);
const pages = () =>
  screen.getAllByLabelText(t.pageLabel).map((input) => (input as HTMLInputElement).value);

beforeEach(() => {
  // `Select` mobil/desktop tanlovi uchun.
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
});
afterEach(cleanup);

describe("appendBulkChapters", () => {
  it("bob va bo'limlar tekis ketma-ket; bo'sh qatorlar tashlanadi", () => {
    const next = appendBulkChapters(
      [
        { title: "Kirish", page: 1 },
        { title: "  ", page: 1 },
      ],
      [
        {
          title: "I bob",
          page: "5",
          children: [
            { title: "1.1", page: "6" },
            { title: "1.2", page: "9" },
          ],
        },
      ],
    );
    expect(next).toEqual([
      { title: "Kirish", page: 1 },
      { title: "I bob", page: 5 },
      { title: "1.1", page: 6 },
      { title: "1.2", page: 9 },
    ]);
  });
});

describe("LibraryDetailsForm: ommaviy kiritish", () => {
  it("nusxalangan mundarija jadvalga qatorlar bo'lib tushadi va saqlanadi", async () => {
    const onSubmit = setup();
    fireEvent.click(screen.getByRole("button", { name: /Bo'lim qo'shish/ }));
    fireEvent.change(screen.getByLabelText(tb.title), {
      target: {
        value: "Kirish ........ 3\nI bob. Asosiy tushunchalar ... 7\n  Ta'riflar ... 8\nmatn\n",
      },
    });
    fireEvent.click(screen.getByRole("button", { name: tb.apply }));

    // Bo'sh qo'shilgan qator o'rniga — 3 ta o'qilgan qator; betsiz qator sanaladi.
    expect(titles()).toEqual(["Kirish", "I bob. Asosiy tushunchalar", "Ta'riflar"]);
    expect(pages()).toEqual(["3", "7", "8"]);
    expect(screen.getByRole("status").textContent).toContain("3 qator qo'shildi");
    expect(screen.getByRole("status").textContent).toContain("1 qator o'qilmadi");

    fireEvent.click(screen.getByRole("button", { name: "Saqlash" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0].chapters).toEqual([
      { title: "Kirish", start_page: 3 },
      { title: "I bob. Asosiy tushunchalar", start_page: 7 },
      { title: "Ta'riflar", start_page: 8 },
    ]);
  });
});
