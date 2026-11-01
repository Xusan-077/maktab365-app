// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import uz from "@/lib/i18n/messages/uz.json";
import type { FindableDocument } from "@/lib/pdf/find";
import { FindDialog } from "./FindDialog";

const t = uz.books.reader.find;

function fakeDoc(pages: string[]): FindableDocument {
  return {
    numPages: pages.length,
    getPage: async (n: number) => ({
      getTextContent: async () => ({ items: pages[n - 1] ? [{ str: pages[n - 1] }] : [] }),
    }),
  };
}

function setup(doc: FindableDocument | null, searchable = true, onGo = vi.fn()) {
  render(
    <NextIntlClientProvider locale="uz" messages={uz}>
      <FindDialog
        open
        onOpenChange={() => undefined}
        doc={doc}
        searchable={searchable}
        onGo={onGo}
      />
    </NextIntlClientProvider>,
  );
  return onGo;
}

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
});
afterEach(cleanup);

describe("FindDialog (PDF.js)", () => {
  it("matn qatlami yo'q kitobda «qidiruv mavjud emas» deydi, kiritish maydoni yo'q", () => {
    setup(fakeDoc(["x"]), false);
    expect(screen.getByText(t.unavailable)).toBeTruthy();
    expect(screen.queryByRole("searchbox")).toBeNull();
  });

  it("so'z kiritilganda PDF matnidan topadi va natija tanlanganda betga o'tadi", async () => {
    const onGo = setup(fakeDoc(["Birinchi bet", "Bu yerda Algebra bor", "Oxirgi"]));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "algebra" } });
    const result = await screen.findByText(t.result.replace("{page}", "2"), {}, { timeout: 3000 });
    fireEvent.click(result);
    expect(onGo).toHaveBeenCalledWith(2, "algebra");
  });

  it("topilmasa «topilmadi» xabarini ko'rsatadi", async () => {
    setup(fakeDoc(["Salom", "Dunyo"]));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "zzz" } });
    await waitFor(() => expect(screen.getByText(t.none.replace("{query}", "zzz"))).toBeTruthy(), {
      timeout: 3000,
    });
  });

  it("skaner (matnsiz) hujjat topilsa qidiruv mavjud emasga o'tadi", async () => {
    const blank = Array.from({ length: 14 }, () => "");
    setup(fakeDoc(blank));
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "algebra" } });
    await waitFor(() => expect(screen.getByText(t.unavailable)).toBeTruthy(), { timeout: 3000 });
  });
});
