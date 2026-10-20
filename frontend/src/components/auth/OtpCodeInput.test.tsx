// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { OtpCodeInput } from "./OtpCodeInput";

const messages = { authForm: { otp: { digit: "{n}-raqam" } } };

function setup(props: Partial<Parameters<typeof OtpCodeInput>[0]> = {}) {
  const onComplete = vi.fn();
  render(
    <NextIntlClientProvider locale="uz" messages={messages}>
      <OtpCodeInput label="Kod" onComplete={onComplete} {...props} />
    </NextIntlClientProvider>,
  );
  const cells = screen.getAllByRole("textbox") as HTMLInputElement[];
  return { onComplete, cells, user: userEvent.setup() };
}

afterEach(cleanup);

describe("OtpCodeInput", () => {
  it("6 ta katak, birinchisiga avtomatik fokus", () => {
    const { cells } = setup();
    expect(cells).toHaveLength(6);
    expect(document.activeElement).toBe(cells[0]);
    expect(cells[0]?.getAttribute("autocomplete")).toBe("one-time-code");
    expect(screen.getByRole("group", { name: "Kod" })).toBeTruthy();
  });

  it("raqam yozilganda fokus keyingi katakka o'tadi, to'lganda onComplete", async () => {
    const { cells, user, onComplete } = setup();
    await user.keyboard("123");
    expect(cells.map((cell) => cell.value).join("")).toBe("123");
    expect(document.activeElement).toBe(cells[3]);
    expect(onComplete).not.toHaveBeenCalled();
    await user.keyboard("456");
    expect(onComplete).toHaveBeenCalledExactlyOnceWith("123456");
  });

  it("harf kiritilmaydi", async () => {
    const { cells, user } = setup();
    await user.keyboard("ab-");
    expect(cells.every((cell) => cell.value === "")).toBe(true);
  });

  it("Backspace oldingi katakka qaytaradi va tozalaydi", async () => {
    const { cells, user } = setup();
    await user.keyboard("12");
    await user.keyboard("{Backspace}");
    expect(cells[1]?.value).toBe("");
    expect(document.activeElement).toBe(cells[1]);
    await user.keyboard("{Backspace}");
    expect(cells[0]?.value).toBe("");
    expect(document.activeElement).toBe(cells[0]);
  });

  it("qo'yilgan kod hamma kataklarga yoyiladi", async () => {
    const { cells, user, onComplete } = setup();
    await user.click(cells[0]!);
    await user.paste("654 321");
    expect(cells.map((cell) => cell.value)).toEqual(["6", "5", "4", "3", "2", "1"]);
    expect(onComplete).toHaveBeenCalledWith("654321");
  });

  it("disabled: kiritish yo'q", async () => {
    const { cells, user, onComplete } = setup({ disabled: true });
    await user.type(cells[0]!, "1");
    expect(cells[0]?.value).toBe("");
    expect(onComplete).not.toHaveBeenCalled();
  });
});
