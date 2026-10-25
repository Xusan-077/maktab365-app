// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Popover } from "./Popover";

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      label="Ko'rinish"
      trigger={(props) => (
        <button type="button" {...props}>
          Aa
        </button>
      )}
    >
      <button type="button">Sepia</button>
    </Popover>
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Popover: fokus sahifani scroll qilmaydi", () => {
  it("ochilganda va Esc'dan keyin fokus `preventScroll` bilan", () => {
    const focus = vi.spyOn(HTMLElement.prototype, "focus");
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "Aa" }));
    const first = screen.getByRole("button", { name: "Sepia" });
    expect(document.activeElement).toBe(first);
    expect(focus.mock.contexts.at(-1)).toBe(first);
    expect(focus.mock.calls.at(-1)).toEqual([{ preventScroll: true }]);

    fireEvent.keyDown(document, { key: "Escape" });
    const trigger = screen.getByRole("button", { name: "Aa" });
    expect(document.activeElement).toBe(trigger);
    expect(focus.mock.contexts.at(-1)).toBe(trigger);
    expect(focus.mock.calls.at(-1)).toEqual([{ preventScroll: true }]);
  });

  it("o'quvchi oynasida html scroll-padding o'chirilgan (sticky sarlavha fokusi sakratmasin)", () => {
    // Regressiya: `html { scroll-padding-top: 5rem }` + bet slotidagi `scroll-mt-20` — sarlavhadagi
    // tugma fokus olganda brauzer sahifani bir betga yuqoriga surardi (30 → 29).
    const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
    expect(css).toMatch(/html:has\(\.pdf-stage\)\s*\{\s*scroll-padding-top:\s*0;?\s*\}/);
  });
});
