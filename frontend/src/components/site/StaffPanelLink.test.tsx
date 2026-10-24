// @vitest-environment jsdom
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import uz from "@/lib/i18n/messages/uz.json";

const auth = vi.hoisted(() => ({ staff: null as "admin" | "editor" | null }));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ sessionUser: auth.staff === undefined ? null : { staff: auth.staff } }),
}));
vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { StaffPanelLink } from "./StaffPanelLink";

function setup(staff: "admin" | "editor" | null) {
  auth.staff = staff;
  render(
    <NextIntlClientProvider locale="uz" messages={uz}>
      <StaffPanelLink />
    </NextIntlClientProvider>,
  );
}

afterEach(cleanup);

describe("StaffPanelLink", () => {
  it.each(["admin", "editor"] as const)("%s: «Boshqaruv paneli» → /admin", (staff) => {
    setup(staff);
    const link = screen.getByTestId("staff-panel-link");
    expect(link.getAttribute("href")).toBe("/admin");
    expect(link.getAttribute("aria-label")).toBe(uz.site.adminPanel);
  });

  it("oddiy foydalanuvchida yo'q", () => {
    setup(null);
    expect(screen.queryByTestId("staff-panel-link")).toBeNull();
  });
});
