// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import uz from "@/lib/i18n/messages/uz.json";
import type { TocChapter } from "@/lib/pdf/toc";
import { TocTree } from "./TocTree";

const t = uz.pdfBooks.toc;

const BOOK: TocChapter[] = [
  { id: "intro", title: "Kirish", page: 3 },
  {
    id: "b1",
    title: "I bob. Algebraik ifodalar",
    page: 5,
    children: [
      { id: "s1", title: "1-§. Ko'phadlar", page: 6 },
      { id: "s2", title: "2-§. Kasrlar", page: 12 },
    ],
  },
  {
    id: "b2",
    title: "II bob. Funksiyalar",
    page: 20,
    children: [{ id: "s3", title: "3-§. Chiziqli funksiya", page: 21 }],
  },
];

function setup(page: number | null, chapters: TocChapter[] = BOOK) {
  return render(
    <NextIntlClientProvider locale="uz" messages={uz}>
      <TocTree
        chapters={chapters}
        page={page}
        testId="toc"
        renderItem={(item, { active }) => (
          <span data-testid="item" data-active={active || undefined}>
            {item.title}
          </span>
        )}
      />
    </NextIntlClientProvider>,
  );
}

const sectionsOf = (title: string) => {
  const group = screen.getByText(title).closest("li")!;
  return group.querySelector("ol")!;
};

afterEach(cleanup);

describe("TocTree", () => {
  it("boblar bo'yicha: joriy bob ochiq, boshqalari yopiq (yopiq bo'limlar DOM'da qoladi)", () => {
    setup(13);

    expect(screen.getAllByTestId("toc-group")).toHaveLength(3);
    expect(sectionsOf("I bob. Algebraik ifodalar").hidden).toBe(false);
    expect(sectionsOf("II bob. Funksiyalar").hidden).toBe(true);
    expect(screen.getByText("3-§. Chiziqli funksiya")).toBeTruthy();
    expect(screen.getByText("2-§. Kasrlar").dataset.active).toBe("true");
    // Bo'limsiz bobda ochish tugmasi yo'q; tartib raqamlari yo'q.
    expect(screen.getAllByTestId("toc-group-toggle")).toHaveLength(2);
    expect(screen.getByTestId("toc").textContent).not.toMatch(/^1/);
  });

  it("tugma bobni ochadi/yopadi (aria-expanded); joriy bobni ham yopish mumkin", () => {
    setup(13);
    const [first, second] = screen.getAllByTestId("toc-group-toggle");
    expect(first.getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(second);
    expect(second.getAttribute("aria-expanded")).toBe("true");
    expect(sectionsOf("II bob. Funksiyalar").hidden).toBe(false);
    fireEvent.click(first);
    expect(sectionsOf("I bob. Algebraik ifodalar").hidden).toBe(true);
  });

  it("sahifa boshqa bobga o'tsa o'sha bob ochiladi", () => {
    const view = setup(6);
    expect(sectionsOf("II bob. Funksiyalar").hidden).toBe(true);

    view.rerender(
      <NextIntlClientProvider locale="uz" messages={uz}>
        <TocTree
          chapters={BOOK}
          page={22}
          renderItem={(item) => <span data-testid="item">{item.title}</span>}
        />
      </NextIntlClientProvider>,
    );
    expect(sectionsOf("II bob. Funksiyalar").hidden).toBe(false);
  });

  it("pozitsiya noma'lum: hamma bob yopiq", () => {
    setup(null);
    for (const toggle of screen.getAllByTestId("toc-group-toggle")) {
      expect(toggle.getAttribute("aria-expanded")).toBe("false");
    }
  });

  it("20 qatorgacha qidiruv yo'q", () => {
    setup(1);
    expect(screen.queryByTestId("toc-search")).toBeNull();
  });

  it("20 dan ko'p qatorda qidiruv: topilgan bo'limlar ochiq ko'rinadi", () => {
    const many: TocChapter[] = Array.from({ length: 3 }, (_, b) => ({
      id: `b${b}`,
      title: `${b + 1}-bob`,
      page: b * 10 + 1,
      children: Array.from({ length: 7 }, (_, s) => ({
        id: `b${b}s${s}`,
        title: `${b * 7 + s + 1}-§ ${s === 3 ? "Tenglamalar" : "Mavzu"}`,
        page: b * 10 + s + 1,
      })),
    }));
    setup(null, many);

    fireEvent.change(screen.getByTestId("toc-search"), { target: { value: "tenglama" } });
    const toc = screen.getByTestId("toc");
    const visible = within(toc)
      .getAllByTestId("item")
      .filter((item) => !item.closest("[hidden]"))
      .map((item) => item.textContent);
    expect(visible).toEqual([
      "1-bob",
      "4-§ Tenglamalar",
      "2-bob",
      "11-§ Tenglamalar",
      "3-bob",
      "18-§ Tenglamalar",
    ]);

    fireEvent.change(screen.getByTestId("toc-search"), { target: { value: "geometriya" } });
    expect(screen.getByRole("status").textContent).toBe(
      t.searchEmpty.replace("{query}", "geometriya"),
    );
  });
});
