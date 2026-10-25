// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import uz from "@/lib/i18n/messages/uz.json";
import type { AdminPdfBook, AdminSlides } from "@/lib/admin/types";

const doc = vi.hoisted(() => ({
  state: { doc: null as { numPages: number } | null, error: null as unknown },
  reload: vi.fn(),
}));

vi.mock("@/components/pdf/usePdfDocument", () => ({
  useSlidesDocument: () => ({ ...doc.state, loading: !doc.state.doc, reload: doc.reload }),
}));
vi.mock("@/components/pdf/PdfPageCanvas", () => ({
  PdfPageCanvas: ({ pageNumber }: { pageNumber: number }) => (
    <canvas data-testid="slide-canvas" data-page={pageNumber} />
  ),
}));
vi.mock("../AdminRoleProvider", () => ({ useAdminIdentity: () => ({ role: "admin" }) }));
vi.mock("@/lib/admin/api", () => ({ getAdminApi: () => ({}) }));
vi.mock("@/hooks/useToast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

import { PresentationEditor } from "./PresentationEditor";

const t = uz.admin.topic.slides;
const ts = uz.admin.slides;
const SLIDES: AdminSlides = {
  name: "kvadrat-tenglama.pdf",
  page_count: 3,
  size_bytes: 2048,
  updated_at: "2026-10-25T08:00:00Z",
};

function setup(slides: AdminSlides | null) {
  const book = {
    id: "book-1",
    chapters: [{ id: "ch-1", title: "Kirish", page: 1, slides, children: [] }],
  } as unknown as AdminPdfBook;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <NextIntlClientProvider locale="uz" messages={uz}>
      <QueryClientProvider client={client}>
        <PresentationEditor book={book} topicId="ch-1" title="Kirish" position="1" />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  doc.state = { doc: { numPages: 3 }, error: null };
});
afterEach(cleanup);

describe("PresentationEditor", () => {
  it("prezentatsiya yo'q: faqat yuklash tugmasi, slaydlar to'ri yo'q", () => {
    setup(null);
    expect(screen.getByRole("button", { name: ts.addFor.replace("{n}", "1") })).toBeTruthy();
    expect(screen.getByTestId("slides-input")).toBeTruthy();
    expect(screen.queryAllByTestId("slide-tile")).toHaveLength(0);
    // Mavzu sahifasining o'zida «Xulosa va taqdimot» havolasi kerak emas.
    expect(screen.queryByTestId("topic-materials-link")).toBeNull();
  });

  it("yuklangan PDF'ning haqiqiy slaydlari: har bet — eskiz, tanlangani katta ko'rinishda", () => {
    setup(SLIDES);
    expect(screen.getByTestId("slides-info").textContent).toContain("kvadrat-tenglama.pdf");
    const tiles = screen.getAllByTestId("slide-tile");
    expect(tiles).toHaveLength(3);
    expect(screen.getByTestId("slides-summary").textContent).toBe(
      t.countPdf.replace("{total}", "3"),
    );
    const large = () =>
      within(screen.getByTestId("slide-large")).getByTestId("slide-canvas").dataset.page;
    expect(large()).toBe("1");
    fireEvent.click(within(tiles[2]).getByRole("button", { name: t.select.replace("{n}", "3") }));
    expect(large()).toBe("3");
    // Almashtirish va o'chirish shu yerda.
    expect(screen.getByRole("button", { name: ts.replaceFor.replace("{n}", "1") })).toBeTruthy();
    expect(screen.getByRole("button", { name: ts.removeFor.replace("{n}", "1") })).toBeTruthy();
  });

  it("PDF ochilmasa xabar va qayta urinish", () => {
    doc.state = { doc: null, error: new Error("boom") };
    setup(SLIDES);
    const alert = screen.getByTestId("slides-preview-error");
    expect(alert.textContent).toContain(t.previewError);
    fireEvent.click(within(alert).getByRole("button", { name: t.retry }));
    expect(doc.reload).toHaveBeenCalled();
  });
});
