// @vitest-environment jsdom
import type { ImgHTMLAttributes } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import uz from "@/lib/i18n/messages/uz.json";
import type * as QueriesModule from "@/lib/topic-materials/queries";
import { MockTopicMaterialsApi } from "@/mocks/topic-materials";

const state = vi.hoisted(() => ({ api: null as unknown as MockTopicMaterialsApi }));
const toast = vi.hoisted(() => vi.fn());

vi.mock("@/lib/topic-materials/api", () => ({ getTopicMaterialsApi: () => state.api }));
vi.mock("@/lib/topic-materials/queries", async (importOriginal) => ({
  ...(await importOriginal<typeof QueriesModule>()),
  CONVERSION_POLL_MS: 0,
}));
vi.mock("@/hooks/useToast", () => ({ useToast: () => ({ toast }) }));
vi.mock("next/image", () => ({
  default: ({
    fill,
    unoptimized,
    ...props
  }: ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; unoptimized?: boolean }) => {
    void fill;
    void unoptimized;
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...props} alt={props.alt ?? ""} />;
  },
}));

import { PresentationEditor } from "./PresentationEditor";

const t = uz.admin.topic.slides;
const file = (name: string, size = 10) => new File([new Uint8Array(size)], name);

function setup() {
  state.api = new MockTopicMaterialsApi();
  const patch = vi.spyOn(state.api, "patchSlides");
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <NextIntlClientProvider locale="uz" messages={uz}>
      <QueryClientProvider client={client}>
        <PresentationEditor topicId="t1" />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
  return { patch };
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("PresentationEditor", () => {
  it("slaydlar to'ri: yashirini belgilangan, tanlangan slayd sozlamalari", async () => {
    setup();
    const tiles = await screen.findAllByTestId("slide-tile");
    expect(tiles).toHaveLength(8);
    expect(tiles[6].dataset.hidden).toBe("true");
    expect(screen.getByTestId("slides-summary").textContent).toContain("8 slayd");
    expect(screen.getByTestId("slides-summary").textContent).toContain("7 tasi");

    fireEvent.click(within(tiles[3]).getByRole("button", { name: t.select.replace("{n}", "4") }));
    const details = screen.getByTestId("slide-details");
    expect(details.getAttribute("aria-label")).toBe(t.details.replace("{n}", "4"));
    expect((within(details).getByLabelText(t.note) as HTMLTextAreaElement).value).toContain(
      "4-slaydda",
    );
  });

  it("ko'rinishni o'chirib, eslatmani yozib saqlash → PATCH (tartib 1..N)", async () => {
    const { patch } = setup();
    await screen.findAllByTestId("slide-tile");
    const save = screen.getByTestId("slides-save") as HTMLButtonElement;
    expect(save.disabled).toBe(true);

    const details = screen.getByTestId("slide-details");
    fireEvent.click(within(details).getByRole("switch"));
    fireEvent.change(within(details).getByLabelText(t.note), { target: { value: "Savol bering" } });
    fireEvent.click(save);

    await waitFor(() => expect(patch).toHaveBeenCalledTimes(1));
    const [id, patches] = patch.mock.calls[0];
    expect(id).toBe("t1-presentation");
    expect(patches.map((p) => p.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(patches[0]).toEqual(
      expect.objectContaining({ id: "t1-slide-1", hidden: true, note: "Savol bering" }),
    );
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: t.saved })),
    );
  });

  it("noto'g'ri fayl rad etiladi (tur, hajm) — so'rov ketmaydi", async () => {
    setup();
    await screen.findAllByTestId("slide-tile");
    const upload = vi.spyOn(state.api, "uploadPresentation");
    const input = screen.getByTestId("slides-file-input");
    fireEvent.change(input, { target: { files: [file("dars.key")] } });
    expect(screen.getByTestId("slides-problem").textContent).toBe(t.problems.type);
    fireEvent.change(input, { target: { files: [file("dars.pdf", 26 * 1024 * 1024)] } });
    expect(screen.getByTestId("slides-problem").textContent).toContain("25");
    expect(upload).not.toHaveBeenCalled();
  });

  it("yuklash → konvertatsiya → yangi slaydlar (12 ta)", async () => {
    setup();
    await screen.findAllByTestId("slide-tile");
    vi.spyOn(state.api, "conversionStatus")
      .mockResolvedValueOnce({ status: "processing", progress: 40 })
      .mockResolvedValue({ status: "ready", progress: 100 });
    const finish = vi.spyOn(state.api, "presentation").mockImplementation(async () => ({
      id: "t1-presentation",
      slide_count: 12,
      pdf_url: "https://cdn.example/t1.pdf",
      slides: Array.from({ length: 12 }, (_, i) => ({
        id: `new-${i + 1}`,
        order: i + 1,
        image_url: "",
        thumb_url: "",
        alt: "",
        note: null,
        hidden: false,
      })),
    }));

    fireEvent.change(screen.getByTestId("slides-file-input"), {
      target: { files: [file("dars.pptx")] },
    });
    await waitFor(() => expect(screen.getAllByTestId("slide-tile")).toHaveLength(12));
    expect(finish).toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: t.ready }));
    expect(screen.getByRole("link", { name: t.pdf }).getAttribute("href")).toBe(
      "https://cdn.example/t1.pdf",
    );
  });

  it("konvertatsiya xatosi: xabar va qayta urinish", async () => {
    setup();
    await screen.findAllByTestId("slide-tile");
    fireEvent.change(screen.getByTestId("slides-file-input"), {
      target: { files: [file("xato.pptx")] },
    });
    const failed = await screen.findByTestId("slides-failed");
    expect(failed.textContent).toContain(t.conversionFailed);
    expect(within(failed).getByRole("button", { name: t.retry })).toBeTruthy();
  });
});
