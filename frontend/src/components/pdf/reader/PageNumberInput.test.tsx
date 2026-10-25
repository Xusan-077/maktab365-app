// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import uz from "@/lib/i18n/messages/uz.json";
import { PageNumberInput } from "./PageNumberInput";

function setup(page = 12, total = 240) {
  const onGo = vi.fn();
  render(
    <NextIntlClientProvider locale="uz" messages={uz}>
      <PageNumberInput page={page} total={total} onGo={onGo} />
    </NextIntlClientProvider>,
  );
  return { onGo, input: screen.getByTestId("pdf-page-input") as HTMLInputElement };
}

afterEach(cleanup);

describe("PageNumberInput", () => {
  it("«12 / 240» ko'rinishida joriy sahifa va jami betni ko'rsatadi", () => {
    const { input } = setup();
    expect(input.value).toBe("12");
    expect(screen.getByTestId("pdf-page-total").textContent).toBe("/ 240");
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
