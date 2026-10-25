// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import type { BookPosition } from "@/hooks/useBookPosition";
import uz from "@/lib/i18n/messages/uz.json";
import { buildBookContents } from "@/lib/pdf/book-contents";
import type { TocChapter } from "@/lib/pdf/toc";

let position: BookPosition = { ready: true, page: null, updatedAt: null };
vi.mock("@/hooks/useBookPosition", () => ({ useBookPosition: () => position }));
vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { BookContents } from "./BookContents";
import { ContentsResumeCard } from "./ContentsResumeCard";

const t = uz.pdfBooks.contents;
const CHAPTERS: TocChapter[] = [
  { id: "rev", title: "8-sinfda o‘rganilgan mavzularni takrorlash", page: 3 },
  {
    id: "c1",
    title: "I bob. Algebraik ifodalar",
    page: 5,
    children: [
      { id: "p1", title: "1-§. Ko‘phadlar", page: 6 },
      { id: "p2", title: "2-§. Kasrlar", page: 12 },
      { id: "t1", title: "I bob bo‘yicha test", page: 19 },
    ],
  },
  {
    id: "c2",
    title: "II bob. Funksiyalar",
    page: 20,
    children: [
      { id: "p3", title: "3-§. Chiziqli funksiya", page: 21 },
      { id: "p4", title: "4-§. Kvadrat funksiya", page: 30 },
    ],
  },
];
const contents = buildBookContents(CHAPTERS, 60);
const book = { grade: 9, slug: "algebra" };

function setup(next: Partial<BookPosition>, node: ReactNode = null) {
  position = { ready: true, page: null, updatedAt: null, ...next };
  return render(
    <NextIntlClientProvider locale="uz" messages={uz} timeZone="Asia/Tashkent">
      {node ?? <BookContents bookId="b1" book={book} contents={contents} />}
    </NextIntlClientProvider>,
  );
}

const header = (name: RegExp) => screen.getByRole("button", { name });
const panelOf = (button: HTMLElement) =>
  document.getElementById(button.getAttribute("aria-controls")!)!;

afterEach(cleanup);

describe("BookContents", () => {
  it("davom etayotgan bob ochiq, qolganlari yopiq; joriy paragraf va «Davom ettirish»", () => {
    setup({ page: 25 });
    const c1 = header(/Algebraik ifodalar/);
    const c2 = header(/Funksiyalar/);
    expect(c1.getAttribute("aria-expanded")).toBe("false");
    expect(c2.getAttribute("aria-expanded")).toBe("true");
    expect(panelOf(c1).hasAttribute("inert")).toBe(true);
    expect(panelOf(c2).hasAttribute("inert")).toBe(false);

    const current = screen.getByRole("link", { current: "step" });
    expect(current.textContent).toContain("Chiziqli funksiya");
    expect(current.getAttribute("href")).toBe("/darsliklar/9/algebra/oqish?page=21");
    expect(screen.getByTestId("contents-paragraph-resume").getAttribute("href")).toBe(
      "/darsliklar/9/algebra/oqish?page=25",
    );
    expect(screen.getByText(/2 paragraf o‘qilgan/)).toBeTruthy();
  });

  it("hech narsa o'qilmagan: birinchi bob ochiq; bob oxiridagi test alohida guruhda", () => {
    setup({ page: null });
    const c1 = header(/Algebraik ifodalar/);
    expect(c1.getAttribute("aria-expanded")).toBe("true");
    const panel = panelOf(c1);
    expect(within(panel).getByText(t.chapterEnd)).toBeTruthy();
    expect(within(panel).getAllByTestId("contents-practice")).toHaveLength(1);
    expect(within(panel).getAllByTestId("contents-paragraph")).toHaveLength(2);
  });

  it("bosish va klaviatura (Enter/Space) bilan ochiladi va yopiladi", async () => {
    const user = userEvent.setup();
    setup({ page: null });
    const c2 = header(/Funksiyalar/);
    fireEvent.click(c2);
    expect(c2.getAttribute("aria-expanded")).toBe("true");
    c2.focus();
    await user.keyboard("{Enter}");
    expect(c2.getAttribute("aria-expanded")).toBe("false");
    await user.keyboard(" ");
    expect(c2.getAttribute("aria-expanded")).toBe("true");
  });

  it("«Hammasini yig'ish» / «Hammasini ochish»", () => {
    setup({ page: null });
    const toggle = screen.getByTestId("contents-toggle-all");
    expect(toggle.textContent).toBe(t.collapseAll);
    fireEvent.click(toggle);
    expect(header(/Algebraik/).getAttribute("aria-expanded")).toBe("false");
    expect(toggle.textContent).toBe(t.expandAll);
    fireEvent.click(toggle);
    expect(header(/Algebraik/).getAttribute("aria-expanded")).toBe("true");
    expect(header(/Funksiyalar/).getAttribute("aria-expanded")).toBe("true");
  });

  it("qidiruv: natija soni, <mark> va mos bob avtomatik ochiladi", () => {
    setup({ page: null });
    fireEvent.change(screen.getByTestId("contents-search"), { target: { value: "kvadrat" } });
    expect(screen.getByTestId("contents-results").textContent).toBe("1 ta natija");
    const c2 = header(/Funksiyalar/);
    expect(c2.getAttribute("aria-expanded")).toBe("true");
    expect(panelOf(c2).querySelector("mark")?.textContent).toBe("Kvadrat");
    expect(screen.queryByRole("button", { name: /Algebraik/ })).toBeNull();
  });

  it("filtr + qidiruv: bo'sh holat va «Tozalash»", () => {
    setup({ page: 25 });
    fireEvent.click(screen.getByRole("radio", { name: t.filters.tests }));
    expect(screen.getByRole("radio", { name: t.filters.tests }).getAttribute("aria-checked")).toBe(
      "true",
    );
    expect(screen.getAllByTestId("contents-practice")).toHaveLength(1);
    fireEvent.change(screen.getByTestId("contents-search"), { target: { value: "kasr" } });
    expect(screen.getByTestId("contents-empty").textContent).toContain(t.empty);
    fireEvent.click(screen.getByRole("button", { name: t.clear }));
    expect(screen.queryByTestId("contents-empty")).toBeNull();
    expect(screen.getByRole("radio", { name: t.filters.all }).getAttribute("aria-checked")).toBe(
      "true",
    );
    expect((screen.getByTestId("contents-search") as HTMLInputElement).value).toBe("");
  });

  it("filtr chiplari strelkalar bilan almashadi (radio guruhi)", async () => {
    const user = userEvent.setup();
    setup({ page: 25 });
    screen.getByRole("radio", { name: t.filters.all }).focus();
    await user.keyboard("{ArrowRight}");
    const inProgress = screen.getByRole("radio", { name: t.filters.inProgress });
    expect(inProgress.getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(inProgress);
    expect(screen.getAllByTestId("contents-chapter")).toHaveLength(1);
  });

  it("Ctrl+K qidiruvga fokus beradi; fokusda bo'lsa global qidiruvga o'tkazadi", () => {
    setup({ page: null });
    const input = screen.getByTestId("contents-search");
    const first = new KeyboardEvent("keydown", { key: "k", ctrlKey: true, cancelable: true });
    document.dispatchEvent(first);
    expect(document.activeElement).toBe(input);
    expect(first.defaultPrevented).toBe(true);
    const second = new KeyboardEvent("keydown", { key: "k", ctrlKey: true, cancelable: true });
    document.dispatchEvent(second);
    expect(second.defaultPrevented).toBe(false);
  });

  it("holat aniq bo'lguncha: boblar yopiq, holat o'rnida skelet", () => {
    setup({ ready: false });
    expect(header(/Algebraik/).getAttribute("aria-expanded")).toBe("false");
    const c1 = header(/Algebraik/);
    expect(within(c1).queryByText(t.chapterUnread)).toBeNull();
    expect(c1.querySelector(".animate-pulse")).not.toBeNull();
    expect(screen.queryByText(/paragraf o‘qilgan/)).toBeNull();
  });
});

describe("ContentsResumeCard", () => {
  const card = <ContentsResumeCard bookId="b1" book={book} contents={contents} />;

  it("o'qilmagan: «O'qishni boshlang» va «1-betdan boshlash», «Boshidan boshlash» yo'q", () => {
    setup({ page: null }, card);
    expect(screen.getByRole("heading").textContent).toBe(t.card.startTitle);
    expect(screen.getByTestId("contents-resume-link").textContent).toBe(t.card.start);
    expect(screen.queryByTestId("contents-restart-link")).toBeNull();
  });

  it("o'qilgan: joy nomi, «bugun HH:MM», progress va havolalar", () => {
    const now = new Date();
    setup({ page: 25, updatedAt: now.toISOString() }, card);
    expect(screen.getByRole("heading").textContent).toBe("3-§ Chiziqli funksiya");
    expect(screen.getByText(/Oxirgi o‘qilgan · bugun \d\d:\d\d/)).toBeTruthy();
    expect(screen.getByText("25 / 60-bet")).toBeTruthy();
    expect(screen.getByText("42% o‘qildi")).toBeTruthy();
    expect(screen.getByTestId("contents-resume-link").getAttribute("href")).toBe(
      "/darsliklar/9/algebra/oqish?page=25",
    );
    expect(screen.getByTestId("contents-restart-link").getAttribute("href")).toBe(
      "/darsliklar/9/algebra/oqish?page=1",
    );
  });
});
