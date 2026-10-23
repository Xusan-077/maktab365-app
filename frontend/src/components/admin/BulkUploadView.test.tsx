// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import uz from "@/lib/i18n/messages/uz.json";

const api = vi.hoisted(() => ({ subjects: vi.fn(), createPdfBook: vi.fn() }));
const upload = vi.hoisted(() => ({ uploadPdf: vi.fn() }));

vi.mock("@/lib/admin/api", () => ({ getAdminApi: () => api }));
vi.mock("@/lib/admin/pdf-upload", () => ({ uploadPdf: upload.uploadPdf, xhrSender: vi.fn() }));
vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import { BulkUploadView } from "./BulkUploadView";

const t = uz.admin.bulk;
const pdf = (name: string) => new File([new Uint8Array(500)], name, { type: "application/pdf" });

function setup() {
  api.subjects.mockResolvedValue([
    { slug: "algebra", title: { uz: "Algebra" } },
    { slug: "tarix", title: { uz: "Tarix" } },
  ]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <NextIntlClientProvider locale="uz" messages={uz}>
      <QueryClientProvider client={client}>
        <BulkUploadView />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

const choose = async (...files: File[]) => {
  // Fanlar yuklanib bo'lgach (taxmin uchun) fayl tanlanadi.
  await screen.findByTestId("bulk-dropzone");
  await waitFor(() => expect(api.subjects).toHaveBeenCalled());
  await new Promise((resolve) => setTimeout(resolve, 20));
  fireEvent.change(screen.getByTestId("bulk-input"), { target: { files } });
};

beforeEach(() => {
  vi.clearAllMocks();
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  api.createPdfBook.mockImplementation(async () => ({ id: `book-${Math.random()}` }));
  upload.uploadPdf.mockResolvedValue({});
});
afterEach(cleanup);

describe("BulkUploadView", () => {
  it("fayl nomidan sinf, fan va nomni taxmin qiladi; to'liq bo'lmagan qator «Yaratish»ni to'sadi", async () => {
    setup();
    await choose(pdf("9-sinf-algebra.pdf"), pdf("kitob.pdf"));

    const rows = await screen.findAllByTestId("bulk-row");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByLabelText(t.titleLabel)).toHaveProperty("value", "Algebra");
    expect(within(rows[0]).queryByTestId("bulk-problem")).toBeNull();
    // 2-qatorda sinf va fan taxmin qilinmadi
    expect(within(rows[1]).getByTestId("bulk-problem").textContent).toContain(t.problems.grade);
    expect((screen.getByTestId("bulk-create") as HTMLButtonElement).disabled).toBe(true);
  });

  it("PDF bo'lmagan va takroriy fayllar qo'shilmaydi / belgilanadi", async () => {
    setup();
    await choose(pdf("9-sinf-algebra.pdf"), pdf("9-sinf-algebra.pdf"));
    expect(await screen.findAllByTestId("bulk-row")).toHaveLength(1);
  });

  it("tayyor qatorlarni ketma-ket yaratadi va yuklaydi", async () => {
    setup();
    await choose(pdf("9-sinf-algebra.pdf"), pdf("8-sinf-tarix.pdf"));
    await screen.findAllByTestId("bulk-row");

    const button = screen.getByTestId("bulk-create") as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    fireEvent.click(button);

    await waitFor(() => expect(api.createPdfBook).toHaveBeenCalledTimes(2));
    expect(api.createPdfBook).toHaveBeenNthCalledWith(1, {
      title: { uz: "Algebra" },
      grade: 9,
      subject: "algebra",
    });
    expect(api.createPdfBook).toHaveBeenNthCalledWith(2, {
      title: { uz: "Tarix" },
      grade: 8,
      subject: "tarix",
    });
    await waitFor(() => expect(upload.uploadPdf).toHaveBeenCalledTimes(2));
    expect(
      await screen.findByText(t.summary.replace("{done}", "2").replace("{total}", "2")),
    ).toBeTruthy();
  });

  it("yuklash yiqilsa qayta urinish yozuvni ikki marta yaratmaydi", async () => {
    upload.uploadPdf.mockRejectedValueOnce(new Error("network"));
    setup();
    await choose(pdf("9-sinf-algebra.pdf"));
    await screen.findAllByTestId("bulk-row");

    fireEvent.click(screen.getByTestId("bulk-create"));
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(api.createPdfBook).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId("bulk-create"));
    await waitFor(() => expect(upload.uploadPdf).toHaveBeenCalledTimes(2));
    expect(api.createPdfBook).toHaveBeenCalledTimes(1);
  });
});
