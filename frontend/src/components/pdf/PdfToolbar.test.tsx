// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import uz from "@/lib/i18n/messages/uz.json";
import { PdfToolbar } from "./PdfToolbar";

function setup(page = 12, total = 240) {
  const onGo = vi.fn();
  render(
    <NextIntlClientProvider locale="uz" messages={uz}>
      <PdfToolbar page={page} total={total} onGo={onGo} />
    </NextIntlClientProvider>,
  );
  return { onGo, input: screen.getByTestId("pdf-page-input") as HTMLInputElement };
}

afterEach(cleanup);

describe("PdfToolbar", () => {
  it("«12 / 240» ko'rinishida joriy sahifa va jami betni ko'rsatadi", () => {
    const { input } = setup();
    expect(input.value).toBe("12");
    expect(screen.getByTestId("pdf-page-total").textContent).toBe("/ 240");
  });

  it("oldingi/keyingi tugmalari bir sahifaga suradi", () => {
    const { onGo } = setup();
    fireEvent.click(screen.getByTestId("pdf-prev"));
    fireEvent.click(screen.getByTestId("pdf-next"));
    expect(onGo).toHaveBeenNthCalledWith(1, 11);
    expect(onGo).toHaveBeenNthCalledWith(2, 13);
  });

  it("birinchi/oxirgi sahifada tegishli tugma o'chiq", () => {
    cleanup();
    setup(1, 5);
    expect((screen.getByTestId("pdf-prev") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId("pdf-next") as HTMLButtonElement).disabled).toBe(false);
    cleanup();
    setup(5, 5);
    expect((screen.getByTestId("pdf-next") as HTMLButtonElement).disabled).toBe(true);
  });

  it("Enter bilan kiritilgan sahifaga o'tadi", () => {
    const { onGo, input } = setup();
    fireEvent.change(input, { target: { value: "57" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onGo).toHaveBeenCalledWith(57);
  });

  it.each([
    ["0", 1],
    ["-5", 1],
    ["999", 240],
  ])("chegaradan tashqari «%s» → %d ga tuzatiladi", (typed, expected) => {
    const { onGo, input } = setup();
    fireEvent.change(input, { target: { value: typed } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onGo).toHaveBeenCalledWith(expected);
  });

  it("raqam bo'lmagan matn joriy sahifani qoldiradi va o'tmaydi", () => {
    const { onGo, input } = setup();
    fireEvent.change(input, { target: { value: "abc" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onGo).not.toHaveBeenCalled();
    expect(input.value).toBe("12");
  });

  it("Escape kiritilganni bekor qiladi", () => {
    const { onGo, input } = setup();
    fireEvent.change(input, { target: { value: "77" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(onGo).not.toHaveBeenCalled();
    expect(input.value).toBe("12");
  });
});
