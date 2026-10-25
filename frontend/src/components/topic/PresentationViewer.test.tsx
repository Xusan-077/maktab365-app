// @vitest-environment jsdom
import type { ImgHTMLAttributes, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import uz from "@/lib/i18n/messages/uz.json";

const nav = vi.hoisted(() => ({
  params: new URLSearchParams(),
  replace: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useSearchParams: () => nav.params }));
vi.mock("next/image", () => ({
  default: ({
    fill,
    priority,
    unoptimized,
    ...props
  }: ImgHTMLAttributes<HTMLImageElement> & {
    fill?: boolean;
    priority?: boolean;
    unoptimized?: boolean;
  }) => {
    void fill;
    void priority;
    void unoptimized;
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...props} alt={props.alt ?? ""} />;
  },
}));
vi.mock("@/lib/i18n/navigation", () => ({
  usePathname: () => "/darsliklar/9/algebra/taqdimot/t1",
  useRouter: () => ({ replace: nav.replace, push: nav.push }),
  Link: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { PresentationViewer } from "./PresentationViewer";

function setup(query = "") {
  nav.params = new URLSearchParams(query);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <NextIntlClientProvider locale="uz" messages={uz}>
      <QueryClientProvider client={client}>
        <PresentationViewer
          topicId="t1"
          topicTitle="Kvadrat tenglama"
          bookTitle="Algebra 9"
          backHref="/darsliklar/9/algebra/oqish?page=40"
        />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("PresentationViewer", () => {
  it("yashirin slaydlar ko'rsatilmaydi: 8 tadan 7 tasi, eskizlar va segmentlar ham", async () => {
    setup();
    expect((await screen.findByTestId("presentation-position")).textContent).toContain("1 / 7");
    expect(screen.getAllByTestId("presentation-thumb")).toHaveLength(7);
    expect(screen.getByTestId("presentation-segments").children).toHaveLength(7);
  });

  it("?slayd=3 bo'yicha ochiladi; → / Space keyingisi, ← oldingisi (URL'ga yoziladi)", async () => {
    setup("slayd=3");
    expect((await screen.findByTestId("presentation-position")).textContent).toContain("3 / 7");
    fireEvent.keyDown(window, { key: "ArrowRight" });
    fireEvent.keyDown(window, { key: " " });
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    const slides = nav.replace.mock.calls.map(([url]) =>
      new URL(url, "http://x").searchParams.get("slayd"),
    );
    expect(slides).toEqual(["4", "5", "4"]);
  });

  it("birinchi slaydda «oldingi» o'chiq, oxirgisida «keyingi» o'chiq", async () => {
    setup("slayd=1");
    expect(((await screen.findByTestId("presentation-prev")) as HTMLButtonElement).disabled).toBe(
      true,
    );
    cleanup();
    setup("slayd=99");
    expect(((await screen.findByTestId("presentation-next")) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("ustoz eslatmasi bor slaydda chiqadi va yashiriladi", async () => {
    setup("slayd=1");
    const note = await screen.findByTestId("presentation-note");
    const toggle = within(note).getByRole("button", { name: uz.presentation.hideNote });
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(within(note).getByText(/Ustoz eslatmasi:/, { selector: "p" }).hidden).toBe(true);
  });

  it("Esc o'qish oynasiga qaytaradi; eskiz bosilsa shu slayd", async () => {
    setup();
    const thumbs = await screen.findAllByTestId("presentation-thumb");
    fireEvent.click(thumbs[5]);
    expect(nav.replace).toHaveBeenLastCalledWith("/darsliklar/9/algebra/taqdimot/t1?slayd=6", {
      scroll: false,
    });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(nav.push).toHaveBeenCalledWith("/darsliklar/9/algebra/oqish?page=40");
  });

  it("PDF manzili bo'lmasa yuklab olish tugmasi yo'q", async () => {
    setup();
    await screen.findByTestId("presentation-position");
    expect(screen.queryByTestId("presentation-pdf")).toBeNull();
  });
});
