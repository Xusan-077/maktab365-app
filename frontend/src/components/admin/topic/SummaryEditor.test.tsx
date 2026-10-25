// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import uz from "@/lib/i18n/messages/uz.json";
import { MockTopicMaterialsApi } from "@/mocks/topic-materials";

const state = vi.hoisted(() => ({ api: null as unknown as MockTopicMaterialsApi }));
const toast = vi.hoisted(() => vi.fn());

vi.mock("@/lib/topic-materials/api", () => ({ getTopicMaterialsApi: () => state.api }));
vi.mock("@/hooks/useToast", () => ({ useToast: () => ({ toast }) }));
// Avtosaqlash debounce'i testda darhol (mantiq o'zi `SummaryForm` da).
vi.mock("@/hooks/useDebouncedValue", () => ({ useDebouncedValue: <T,>(value: T) => value }));

import { SummaryEditor } from "./SummaryEditor";

const t = uz.admin.topic.summary;

function setup() {
  state.api = new MockTopicMaterialsApi();
  const save = vi.spyOn(state.api, "saveSummary");
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <NextIntlClientProvider locale="uz" messages={uz} timeZone="Asia/Tashkent">
      <QueryClientProvider client={client}>
        <SummaryEditor topicId="t1" />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
  return { save };
}

const cards = () => screen.getAllByTestId("summary-block-card");
const saveState = () => screen.getByTestId("summary-save-state").dataset.state;

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

describe("SummaryEditor", () => {
  it("saqlangan bloklar kartalarda va jonli ko'rinishda (o'quvchi komponenti bilan)", async () => {
    setup();
    await screen.findAllByTestId("summary-block-card");
    expect(cards().map((card) => card.dataset.type)).toEqual([
      "idea",
      "bullets",
      "chips",
      "example",
      "teacher_note",
    ]);
    const preview = screen.getByTestId("summary-preview");
    expect(within(preview).getByTestId("summary-blocks").children).toHaveLength(5);
    expect(within(preview).getByText(uz.topic.verified)).toBeTruthy();
    expect(saveState()).toBe("saved");
  });

  it("tahrir avtosaqlanadi va ko'rinishda darhol chiqadi", async () => {
    const { save } = setup();
    const [idea] = await screen.findAllByTestId("summary-block-card");
    fireEvent.change(within(idea).getByLabelText(t.fields.title), {
      target: { value: "Yangi g‘oya" },
    });
    expect(within(screen.getByTestId("summary-preview")).getByText("Yangi g‘oya")).toBeTruthy();
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0][1].blocks[0]).toEqual(
      expect.objectContaining({ type: "idea", title: "Yangi g‘oya" }),
    );
    await waitFor(() => expect(saveState()).toBe("saved"));
  });

  it("nashr holatida bo'sh blok saqlanmaydi; qoralamaga o'tilsa saqlanadi", async () => {
    const { save } = setup();
    await screen.findAllByTestId("summary-block-card");
    fireEvent.click(screen.getByTestId("summary-add-block"));
    fireEvent.click(screen.getByTestId("summary-add-example"));
    expect(cards()).toHaveLength(6);
    await waitFor(() => expect(saveState()).toBe("invalid"));
    expect(save).not.toHaveBeenCalled();
    expect(within(cards()[5]).getByText(uz.admin.topic.errors.required)).toBeTruthy();

    fireEvent.click(screen.getByTestId("summary-status-draft"));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0][1]).toEqual(
      expect.objectContaining({ status: "draft", blocks: expect.any(Array) }),
    );
    expect(save.mock.calls[0][1].blocks).toHaveLength(6);
  });

  it("AI bilan to'ldirish: mavjud bloklar tasdiq bilan almashadi, holat — qoralama", async () => {
    const { save } = setup();
    await screen.findAllByTestId("summary-block-card");
    fireEvent.click(screen.getByTestId("summary-ai"));
    const dialog = await screen.findByRole("dialog", { name: t.ai.replaceTitle });
    fireEvent.click(within(dialog).getByRole("button", { name: t.ai.replace }));
    await waitFor(() => expect(cards()).toHaveLength(3));
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(save.mock.lastCall?.[1].status).toBe("draft");
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: t.ai.applied }));
  });

  it("matnli blokni o'chirish tasdiqlanadi; Desktop/Mobil almashtirgich", async () => {
    setup();
    await screen.findAllByTestId("summary-block-card");
    fireEvent.click(within(cards()[0]).getByTestId("summary-block-remove"));
    const dialog = await screen.findByRole("dialog", { name: t.removeTitle });
    fireEvent.click(within(dialog).getByRole("button", { name: uz.admin.common.delete }));
    await waitFor(() => expect(cards()).toHaveLength(4));
    expect(cards()[0].dataset.type).toBe("bullets");

    expect(screen.getByTestId("summary-preview").dataset.device).toBe("desktop");
    fireEvent.click(screen.getByTestId("summary-preview-mobile"));
    expect(screen.getByTestId("summary-preview").dataset.device).toBe("mobile");
  });

  it("sudrash dastagi klaviatura uchun nomlangan, kalit so'z qo'shish Enter bilan", async () => {
    setup();
    await screen.findAllByTestId("summary-block-card");
    const handle = within(cards()[0]).getByTestId("summary-block-drag");
    expect(handle.getAttribute("aria-label")).toBe(
      t.drag.replace("{n}", "1").replace("{type}", t.types.idea.title),
    );
    const chips = cards()[2];
    const input = within(chips).getByLabelText(t.chips, { selector: "input" });
    fireEvent.change(input, { target: { value: "ildiz formulasi" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(within(chips).getByText("ildiz formulasi")).toBeTruthy();
  });
});
