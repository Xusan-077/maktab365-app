// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import uz from "@/lib/i18n/messages/uz.json";
import { useToastStore } from "@/stores/toast.store";
import { Toaster } from "./Toast";

afterEach(() => {
  cleanup();
  useToastStore.setState({ toasts: [] });
});

describe("Toaster", () => {
  it("amal tugmasi bajariladi va xabar yopiladi", () => {
    const onClick = vi.fn();
    render(
      <NextIntlClientProvider locale="uz" messages={uz}>
        <Toaster />
      </NextIntlClientProvider>,
    );
    act(() => {
      useToastStore
        .getState()
        .push({ title: "O'chirildi", action: { label: "Qaytarish", onClick } });
    });
    fireEvent.click(screen.getByTestId("toast-action"));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });
});
