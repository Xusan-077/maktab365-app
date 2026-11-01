// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import uz from "@/lib/i18n/messages/uz.json";
import { ApiError } from "@/lib/api/types";
import { PdfLoadError } from "./PdfLoadError";

vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

const errors = uz.pdfBooks.reader.loadErrors;

function show(props: Parameters<typeof PdfLoadError>[0]) {
  return render(
    <NextIntlClientProvider locale="uz" messages={uz}>
      <PdfLoadError {...props} />
    </NextIntlClientProvider>,
  );
}

const setOnline = (value: boolean) =>
  Object.defineProperty(window.navigator, "onLine", { configurable: true, get: () => value });

afterEach(() => {
  cleanup();
  setOnline(true);
});

describe("PdfLoadError", () => {
  it("tarmoq xatosi: tushuntirish va «Qayta urinish», ro'yxat havolasisiz", () => {
    const onRetry = vi.fn();
    show({ error: new ApiError("x", 0, { code: "network_error" }), onRetry });
    const alert = screen.getByRole("alert");
    expect(alert.dataset.problem).toBe("network");
    expect(alert.textContent).toContain(errors.network);
    expect(screen.queryByRole("link")).toBeNull();
    fireEvent.click(screen.getByTestId("pdf-load-retry"));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("internet yo'q: «o'zi yuklanadi», tugma o'chiq; ulanish qaytsa yoqiladi", () => {
    setOnline(false);
    show({ error: new TypeError("Failed to fetch"), onRetry: vi.fn() });
    expect(screen.getByRole("alert").dataset.problem).toBe("offline");
    expect(screen.getByRole("alert").textContent).toContain(errors.offline);
    expect((screen.getByTestId("pdf-load-retry") as HTMLButtonElement).disabled).toBe(true);
    setOnline(true);
    act(() => void window.dispatchEvent(new Event("online")));
    expect(screen.getByRole("alert").dataset.problem).toBe("network");
    expect((screen.getByTestId("pdf-load-retry") as HTMLButtonElement).disabled).toBe(false);
  });

  it("fayl topilmadi — darsliklar ro'yxatiga havola", () => {
    show({ error: new ApiError("x", 404, { code: "not_found" }), onRetry: vi.fn() });
    expect(screen.getByRole("alert").textContent).toContain(errors.notFound);
    expect(screen.getByRole("link").textContent).toBe(errors.catalog);
  });

  it("sahifa chizilmadi — alohida sarlavha", () => {
    show({ render: true, onRetry: vi.fn() });
    expect(screen.getByRole("heading").textContent).toBe(errors.renderTitle);
    expect(screen.getByRole("alert").textContent).toContain(errors.render);
  });
});
