// @vitest-environment jsdom
import { Activity } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

interface FakeDoc {
  id: number;
  destroyed: boolean;
}

const pdf = vi.hoisted(() => ({ opened: [] as FakeDoc[] }));

vi.mock("@/lib/offline/pdf-cache", () => ({ loadOfflinePdf: async () => null }));
vi.mock("@/lib/pdf-books/queries", () => ({
  pdfQueries: {
    fileUrl: (bookId: string) => ({
      queryKey: ["pdf-file", bookId],
      queryFn: async () => ({ url: "/files/book.pdf" }),
    }),
  },
}));
vi.mock("@/lib/pdf/pdfjs", () => ({
  pdfjsAssetOptions: () => ({}),
  loadPdfjs: async () => ({
    getDocument: () => {
      const doc: FakeDoc = { id: pdf.opened.length + 1, destroyed: false };
      pdf.opened.push(doc);
      return {
        promise: Promise.resolve(doc),
        destroy: async () => {
          doc.destroyed = true;
        },
      };
    },
  }),
}));

import { usePdfDocument } from "./usePdfDocument";

/** Har render'da qaysi hujjat berilgani va u o'sha paytda yo'q qilingan-qilinmagani. */
const renders: { id: number | null; destroyed: boolean }[] = [];

function Reader() {
  const { doc } = usePdfDocument("book-1");
  const fake = doc as unknown as FakeDoc | null;
  renders.push({ id: fake?.id ?? null, destroyed: fake?.destroyed ?? false });
  return null;
}

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = (mode: "visible" | "hidden") => (
    <QueryClientProvider client={client}>
      <Activity mode={mode}>
        <Reader />
      </Activity>
    </QueryClientProvider>
  );
  const { rerender } = render(view("visible"));
  return (mode: "visible" | "hidden") => rerender(view(mode));
}

beforeEach(() => {
  pdf.opened.length = 0;
  renders.length = 0;
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("usePdfDocument: <Activity> yashirib qaytarganda", () => {
  it("yo'q qilingan hujjat bolalarga berilmaydi, hujjat qayta ochiladi", async () => {
    const setMode = setup();
    await waitFor(() => expect(renders.at(-1)?.id).toBe(1));

    // Orqaga navigatsiya: Next sahifani `<Activity mode="hidden">` qiladi — effekt tozalanadi.
    await act(async () => setMode("hidden"));
    expect(pdf.opened[0].destroyed).toBe(true);

    await act(async () => setMode("visible"));
    await waitFor(() => expect(renders.at(-1)?.id).toBe(2));

    // Regressiya: avval 1-hujjat (yo'q qilingan) state'da qolib, `doc.getPage` yiqilardi.
    expect(renders.filter((entry) => entry.destroyed)).toEqual([]);
  });
});
