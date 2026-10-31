// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import uz from "@/lib/i18n/messages/uz.json";
import type { AdminQuestion } from "@/lib/admin/types";

const api = vi.hoisted(() => ({
  topicQuestions: vi.fn(),
  createQuestion: vi.fn(),
  updateQuestion: vi.fn(),
  deleteQuestion: vi.fn(),
  reorderQuestions: vi.fn(),
  importQuestions: vi.fn(),
  upload: vi.fn(),
}));
const identity = vi.hoisted(() => ({ role: "admin" }));

vi.mock("@/lib/admin/api", () => ({ getAdminApi: () => api }));
vi.mock("../AdminRoleProvider", () => ({ useAdminIdentity: () => identity }));
vi.mock("@/hooks/useToast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

import { QuestionsEditor } from "./QuestionsEditor";

const t = uz.admin.questions;
const TOPIC = "topic-1";

const question = (n: number, active = true): AdminQuestion => ({
  id: `q${n}`,
  topic: TOPIC,
  text: { uz: `Savol ${n}` },
  image: "",
  image_url: null,
  difficulty: "easy",
  order: n,
  is_active: active,
  options: [0, 1, 2, 3].map((order) => ({
    id: `q${n}-o${order}`,
    text: { uz: `V${order}` },
    is_correct: order === 2,
    order,
  })),
  created_at: "2026-10-27T00:00:00Z",
  updated_at: "2026-10-27T00:00:00Z",
});

function setup(questions: AdminQuestion[], role = "admin") {
  identity.role = role;
  api.topicQuestions.mockResolvedValue(questions);
  api.createQuestion.mockResolvedValue(question(99));
  api.updateQuestion.mockResolvedValue(questions[0]);
  api.importQuestions.mockResolvedValue({ created: 1, dry_run: false });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <NextIntlClientProvider locale="uz" messages={uz}>
      <QueryClientProvider client={client}>
        <QuestionsEditor topicId={TOPIC} />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
});
afterEach(cleanup);

describe("QuestionsEditor", () => {
  it("lists questions with answer letter and readiness", async () => {
    setup([question(1), question(2, false)]);
    const rows = await screen.findAllByTestId("question-row");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("Savol 1")).toBeTruthy();
    expect(within(rows[0]).getByText("Javob: C")).toBeTruthy();
    expect(rows[1].dataset.active).toBe("false");
    expect(screen.getByText(t.notReady.replace("{n}", "7"))).toBeTruthy();
  });

  it("toggles active optimistically", async () => {
    setup([question(1)]);
    const row = await screen.findByTestId("question-row");
    fireEvent.click(within(row).getByTestId("question-active"));
    await waitFor(() => expect(row.dataset.active).toBe("false"));
    await waitFor(() =>
      expect(api.updateQuestion).toHaveBeenCalledWith("q1", { is_active: false }),
    );
  });

  it("hides delete for editors", async () => {
    setup([question(1)], "editor");
    await screen.findByTestId("question-row");
    expect(screen.queryByLabelText(t.remove.replace("{n}", "1"))).toBeNull();
  });

  it("requires the correct answer before creating", async () => {
    setup([]);
    fireEvent.click(await screen.findByTestId("question-add"));
    const form = await screen.findByTestId("question-form");
    fireEvent.change(
      within(form).getByLabelText(uz.admin.localized.uz, { selector: "#question-text-uz" }),
      {
        target: { value: "2+2?" },
      },
    );
    for (let i = 0; i < 4; i++) {
      fireEvent.change(form.querySelector(`#question-option-${i}-uz`)!, {
        target: { value: String(i + 3) },
      });
    }
    fireEvent.submit(form);
    expect(await within(form).findByText(t.errors.correctRequired)).toBeTruthy();
    expect(api.createQuestion).not.toHaveBeenCalled();

    fireEvent.click(form.querySelector('input[name="correct"][value="1"]')!);
    fireEvent.submit(form);
    await waitFor(() => expect(api.createQuestion).toHaveBeenCalled());
    const [topicId, input] = api.createQuestion.mock.calls[0];
    expect(topicId).toBe(TOPIC);
    expect(input.text).toEqual({ uz: "2+2?" });
    expect(input.options.map((o: { is_correct: boolean }) => o.is_correct)).toEqual([
      false,
      true,
      false,
      false,
    ]);
  });

  it("imports only valid rows after preview", async () => {
    setup([]);
    fireEvent.click(await screen.findByText(t.importButton));
    const dialog = await screen.findByTestId("question-import");
    fireEvent.change(within(dialog).getByLabelText(t.import.paste), {
      target: { value: "Q1;a;b;c;d;B\nQ2;a;b;c;d;Z" },
    });
    const rows = within(dialog).getAllByTestId("import-row");
    expect(rows.map((row) => row.dataset.valid)).toEqual(["true", "false"]);
    fireEvent.click(within(dialog).getByTestId("question-import-submit"));
    await waitFor(() => expect(api.importQuestions).toHaveBeenCalled());
    const [, items] = api.importQuestions.mock.calls[0];
    expect(items).toHaveLength(1);
    expect(items[0].options[1].is_correct).toBe(true);
  });
});
