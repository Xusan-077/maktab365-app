// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ChapterDraft } from "@/lib/admin/chapters";
import uz from "@/lib/i18n/messages/uz.json";
import { ChaptersEditor } from "./ChaptersEditor";

const t = uz.admin.toc;

const row = (key: string, title: string, page: string, children: ChapterDraft["children"] = []) =>
  ({ key, title, page, children }) satisfies ChapterDraft;

function Harness({ initial, showProblems }: { initial: ChapterDraft[]; showProblems?: boolean }) {
  const [value, setValue] = useState(initial);
  return (
    <ChaptersEditor value={value} onChange={setValue} pageCount={300} showProblems={showProblems} />
  );
}

function setup(initial: ChapterDraft[], showProblems = false) {
  render(
    <NextIntlClientProvider locale="uz" messages={uz}>
      <Harness initial={initial} showProblems={showProblems} />
    </NextIntlClientProvider>,
  );
}

const titles = () =>
  screen.getAllByTestId("toc-title").map((input) => (input as HTMLInputElement).value);
const invalid = () =>
  screen.getAllByTestId("toc-row-fields").map((fields) => fields.dataset.invalid === "true");

afterEach(cleanup);

describe("ChaptersEditor: bet tartibi", () => {
  it("218 → 214 → 216: 214-qator darrov qizil (yuborishni kutmaydi)", () => {
    setup([row("a", "A", "218"), row("b", "B", "214"), row("c", "C", "216")]);

    expect(invalid()).toEqual([false, true, false]);
    expect(screen.getByText(t.problems.pageOrder)).toBeTruthy();
  });

  it("bo'sh sarlavha faqat yuborishga urinishdan keyin ko'rsatiladi", () => {
    setup([row("a", "", "5")]);
    expect(invalid()).toEqual([false]);
    cleanup();
    setup([row("a", "", "5")], true);
    expect(invalid()).toEqual([true]);
  });
});

describe("ChaptersEditor: indent / outdent", () => {
  it("→ qatorni oldingi bob ichiga ko'chiradi, ← qaytaradi", () => {
    setup([row("a", "I bob", "1"), row("b", "1-§", "2"), row("c", "II bob", "5")]);
    const indents = screen.getAllByTestId("toc-indent") as HTMLButtonElement[];
    expect(indents[0].disabled).toBe(true); // birinchi qator

    fireEvent.click(indents[1]);
    expect(screen.getAllByTestId("toc-row")).toHaveLength(2);
    expect(titles()).toEqual(["I bob", "1-§", "II bob"]);
    expect(screen.getAllByTestId("toc-outdent")).toHaveLength(1);

    fireEvent.click(screen.getByTestId("toc-outdent"));
    expect(screen.getAllByTestId("toc-row")).toHaveLength(3);
    expect(screen.queryByTestId("toc-outdent")).toBeNull();
  });

  it("«Ommaviy kiritish»: «I bob» qatorlari bob, qolganlari uning bo'limlari", () => {
    setup([]);
    fireEvent.change(screen.getByLabelText(t.bulk.title), {
      target: { value: "I bob Sonlar 3\n1-§ Natural sonlar 4\n2-§ Kasrlar 9\nII bob Shakllar 15" },
    });
    fireEvent.click(screen.getByText(t.bulk.apply));

    expect(screen.getAllByTestId("toc-row")).toHaveLength(2);
    expect(titles()).toEqual([
      "I bob Sonlar",
      "1-§ Natural sonlar",
      "2-§ Kasrlar",
      "II bob Shakllar",
    ]);
    expect(screen.getAllByTestId("toc-outdent")).toHaveLength(2);
  });
});
