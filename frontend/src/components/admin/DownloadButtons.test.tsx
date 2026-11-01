// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import uz from "@/lib/i18n/messages/uz.json";
import type { StaffIdentity } from "@/lib/admin/server";
import { AdminRoleProvider } from "./AdminRoleProvider";
import { DownloadButtons } from "./DownloadButtons";

vi.mock("@/hooks/useToast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

afterEach(cleanup);

const t = uz.admin.downloads;

function setup(role: "admin" | "editor") {
  render(
    <NextIntlClientProvider locale="uz" messages={uz}>
      <AdminRoleProvider identity={{ role } as unknown as StaffIdentity}>
        <DownloadButtons target={{ kind: "library", id: "b1" }} title="Kitob" hasFile hasCover />
      </AdminRoleProvider>
    </NextIntlClientProvider>,
  );
}

describe("DownloadButtons", () => {
  it("admin PDF va muqova tugmalarini ko'radi", () => {
    setup("admin");
    expect(screen.getByRole("button", { name: t.pdf })).toBeTruthy();
    expect(screen.getByRole("button", { name: t.cover })).toBeTruthy();
  });

  it("muharrir (editor) ularni ko'rmaydi", () => {
    setup("editor");
    expect(screen.queryByRole("button", { name: t.pdf })).toBeNull();
    expect(screen.queryByRole("button", { name: t.cover })).toBeNull();
  });
});
