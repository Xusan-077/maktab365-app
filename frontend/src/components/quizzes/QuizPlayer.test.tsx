// @vitest-environment jsdom
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import uz from "@/lib/i18n/messages/uz.json";
import type { PlayQuestion } from "@/lib/quizzes/play";
import { QuizPlayer, type CheckOutcome } from "./QuizPlayer";

const questions: PlayQuestion[] = ["q1", "q2"].map((id) => ({
  id,
  text: `Savol ${id}`,
  imageUrl: null,
  options: [
    { id: `${id}-a`, text: `${id} A` },
    { id: `${id}-b`, text: `${id} B` },
  ],
}));

const correctCheck = async (q: PlayQuestion, optionId: string | null): Promise<CheckOutcome> => ({
  correct: optionId === `${q.id}-a`,
  correctOptionId: `${q.id}-a`,
});

function setup(
  options: { timePerQuestion?: number | null; strict?: boolean; check?: typeof correctCheck } = {},
) {
  const onFinish = vi.fn();
  const ui = (
    <NextIntlClientProvider locale="uz" messages={uz}>
      <QuizPlayer
        questions={questions}
        timePerQuestion={options.timePerQuestion ?? null}
        check={options.check ?? correctCheck}
        onFinish={onFinish}
      />
    </NextIntlClientProvider>
  );
  const view = render(options.strict ? <StrictMode>{ui}</StrictMode> : ui);
  return { onFinish, ...view };
}

const flush = () => act(async () => void (await Promise.resolve()));

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("QuizPlayer natija yuborishi", () => {
  it("hech narsa o'ynalmasa va unmount bo'lsa, natija chiqmaydi (Strict Mode ham)", async () => {
    const { onFinish, unmount } = setup({ strict: true, timePerQuestion: 15 });
    await flush();
    unmount();
    await act(async () => void vi.advanceTimersByTime(60_000));
    expect(onFinish).not.toHaveBeenCalled();
  });

  it("oxirgi savoldan keyin natija bir marta chiqadi (Strict Mode)", async () => {
    const { onFinish } = setup({ strict: true });
    for (const id of ["q1", "q2"]) {
      fireEvent.click(screen.getByText(`${id} A`));
      await flush();
      fireEvent.click(screen.getByRole("button", { name: /Keyingi|Natijani ko.rish/ }));
    }
    await flush();
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onFinish.mock.calls[0][0].picks).toHaveLength(2);
  });

  it("taymer tugashi bilan bosish bir vaqtda kelsa, bosilgan javob yo'qolmaydi", async () => {
    // Tekshiruv sekin: taymer tugagach ham birinchi chaqiruv hali tugamagan.
    let release: (outcome: CheckOutcome) => void = () => undefined;
    const check = vi.fn(
      () =>
        new Promise<CheckOutcome>((resolve) => {
          release = resolve;
        }),
    );
    setup({ timePerQuestion: 15, check });
    // Bitta act ichida: render orasida `busy` hali yangilanmagan holat.
    await act(async () => {
      fireEvent.keyDown(window, { key: "1" });
      vi.advanceTimersByTime(20_000);
    });
    expect(check).toHaveBeenCalledTimes(1);
    expect(check).toHaveBeenCalledWith(expect.anything(), "q1-a");
    await act(async () => release({ correct: true, correctOptionId: "q1-a" }));
  });

  it("vaqt tugasa, javobsiz savol bir marta qayd etiladi", async () => {
    const check = vi.fn(correctCheck);
    setup({ timePerQuestion: 15, check });
    await act(async () => void vi.advanceTimersByTime(16_000));
    expect(check).toHaveBeenCalledTimes(1);
    expect(check).toHaveBeenCalledWith(expect.anything(), null);
  });
});
