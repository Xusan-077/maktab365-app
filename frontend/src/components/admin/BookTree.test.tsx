// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import type { StaffRole } from "@/lib/auth/tokens";
import uz from "@/lib/i18n/messages/uz.json";
import type { AdminChapter, AdminTopicItem } from "@/lib/admin/types";

const api = vi.hoisted(() => ({
  chapters: vi.fn(),
  topics: vi.fn(),
  reorder: vi.fn(),
  transition: vi.fn(),
  deleteChapter: vi.fn(),
  deleteTopic: vi.fn(),
}));

vi.mock("@/lib/admin/api", () => ({ getAdminApi: () => api }));
vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { AdminRoleProvider } from "./AdminRoleProvider";
import { BookTree } from "./BookTree";

const chapter = (id: string, order: number) =>
  ({ id, slug: id, title: { uz: `Bob ${id}` }, order }) as AdminChapter;
const topic = (id: string, chapterId: string, order: number, status = "draft") =>
  ({
    id,
    slug: id,
    chapter: chapterId,
    title: { uz: `Mavzu ${id}` },
    order,
    status,
  }) as AdminTopicItem;

function setup(role: StaffRole = "editor") {
  api.chapters.mockResolvedValue([chapter("c1", 1), chapter("c2", 2)]);
  api.topics.mockResolvedValue([
    topic("t1", "c1", 1),
    topic("t2", "c1", 2, "published"),
    topic("t3", "c2", 1, "reviewed"),
  ]);
  api.reorder.mockResolvedValue(undefined);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <NextIntlClientProvider locale="uz" messages={uz}>
      <QueryClientProvider client={client}>
        <AdminRoleProvider identity={{ role, email: "x@example.com" }}>
          <BookTree bookId="book-1" />
        </AdminRoleProvider>
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

const topicTitles = () =>
  screen.getAllByTestId("tree-topic").map((row) => within(row).getAllByRole("link")[0].textContent);

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("BookTree", () => {
  it("boblar va mavzularni tartib bilan chizadi", async () => {
    setup();
    await screen.findByTestId("tree");
    expect(screen.getAllByTestId("tree-chapter")).toHaveLength(2);
    expect(topicTitles()).toEqual(["Mavzu t1", "Mavzu t2", "Mavzu t3"]);
  });

  it("mavzuni pastga siljitish bitta reorder so'rovi yuboradi", async () => {
    setup();
    await screen.findByTestId("tree");
    fireEvent.click(screen.getByRole("button", { name: "Pastga: Mavzu t1" }));
    await waitFor(() => expect(api.reorder).toHaveBeenCalledTimes(1));
    expect(api.reorder).toHaveBeenCalledWith("book-1", { topics: { c1: ["t2", "t1"] } });
  });

  it("bobni yuqoriga siljitish faqat bob tartibini yuboradi", async () => {
    setup();
    await screen.findByTestId("tree");
    fireEvent.click(screen.getByRole("button", { name: "Yuqoriga: Bob c2" }));
    await waitFor(() => expect(api.reorder).toHaveBeenCalledTimes(1));
    expect(api.reorder).toHaveBeenCalledWith("book-1", { chapters: ["c2", "c1"] });
  });

  it("mavzuni boshqa bobga sudrab ko'chirish (drag&drop) ikkala bobni yuboradi", async () => {
    setup();
    await screen.findByTestId("tree");
    const rows = screen.getAllByTestId("tree-topic");
    const target = rows[2]; // Mavzu t3 (c2) ustiga tashlanadi → t3 dan oldin
    fireEvent.dragStart(rows[0], { dataTransfer: { setData: vi.fn(), effectAllowed: "" } });
    fireEvent.dragOver(target);
    fireEvent.drop(target);
    await waitFor(() => expect(api.reorder).toHaveBeenCalledTimes(1));
    expect(api.reorder).toHaveBeenCalledWith("book-1", {
      topics: { c1: ["t2"], c2: ["t1", "t3"] },
    });
  });

  it("birinchi elementning 'yuqoriga' va oxirgisining 'pastga' tugmasi o'chiq", async () => {
    setup();
    await screen.findByTestId("tree");
    expect(
      (screen.getByRole("button", { name: "Yuqoriga: Mavzu t1" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Pastga: Mavzu t2" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Pastga: Bob c2" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("harakat tugmalari rolga qarab: editor nashrni qaytara olmaydi va o'chira olmaydi", async () => {
    setup("editor");
    await screen.findByTestId("tree");
    expect(screen.getByRole("button", { name: "Tekshirildi" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Nashr qilish" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Qoralamaga qaytarish" })).toBeNull();
    expect(screen.queryByRole("button", { name: /o'chirish/i })).toBeNull();
  });

  it("admin nashrni qoralamaga qaytara oladi va o'chira oladi", async () => {
    setup("admin");
    await screen.findByTestId("tree");
    expect(screen.getByRole("button", { name: "Qoralamaga qaytarish" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Mavzuni o'chirish: Mavzu t1" })).toBeTruthy();
  });

  it("reorder xatosida daraxt serverdagi tartibga qaytadi", async () => {
    setup();
    await screen.findByTestId("tree");
    api.reorder.mockRejectedValueOnce(new Error("boom"));
    fireEvent.click(screen.getByRole("button", { name: "Pastga: Mavzu t1" }));
    await waitFor(() => expect(api.reorder).toHaveBeenCalled());
    await waitFor(() => expect(topicTitles()).toEqual(["Mavzu t1", "Mavzu t2", "Mavzu t3"]));
  });
});
