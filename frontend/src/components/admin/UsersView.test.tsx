// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { ApiError } from "@/lib/api/types";
import uz from "@/lib/i18n/messages/uz.json";
import type { AdminUser } from "@/lib/admin/types";

const api = vi.hoisted(() => ({
  users: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
}));
const identity = vi.hoisted(() => ({ role: "admin", email: "me@example.com" }));
const nav = vi.hoisted(() => ({ replace: vi.fn(), query: "" }));

vi.mock("@/lib/admin/api", () => ({ getAdminApi: () => api }));
vi.mock("./AdminRoleProvider", () => ({ useAdminIdentity: () => identity }));
vi.mock("@/hooks/useToast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(nav.query) }));
vi.mock("@/lib/i18n/navigation", () => ({
  usePathname: () => "/admin/foydalanuvchilar",
  useRouter: () => ({ replace: nav.replace }),
}));
vi.mock("@/components/ui/motion", async () => {
  const React = await import("react");
  return {
    listItem: {},
    m: { tr: (props: Record<string, unknown>) => React.createElement("tr", stripMotion(props)) },
  };
});

function stripMotion(props: Record<string, unknown>) {
  const motionProps = ["variants", "initial", "animate", "custom"];
  return Object.fromEntries(Object.entries(props).filter(([key]) => !motionProps.includes(key)));
}

import { UsersView } from "./UsersView";

const t = uz.admin.users;
const user = (over: Partial<AdminUser>): AdminUser => ({
  id: "id-1",
  email: "ali@example.com",
  display_name: "Ali",
  role: "student",
  is_active: true,
  is_env_admin: false,
  date_joined: "2026-01-02T00:00:00Z",
  ...over,
});
const USERS = [
  user({
    id: "env",
    email: "boss@example.com",
    display_name: "Boss",
    role: "admin",
    is_env_admin: true,
  }),
  user({ id: "me", email: "me@example.com", display_name: "Men", role: "admin" }),
  user({ id: "ali", email: "ali@example.com", display_name: "Ali" }),
  user({ id: "bad", email: "bad@example.com", display_name: "Bad", is_active: false }),
];

function setup(list: AdminUser[] = USERS) {
  api.users.mockResolvedValue({ count: list.length, results: list });
  api.createUser.mockResolvedValue({ ...USERS[2], temporary_password: null });
  api.updateUser.mockResolvedValue(USERS[2]);
  api.deleteUser.mockResolvedValue(undefined);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <NextIntlClientProvider locale="uz" messages={uz}>
      <QueryClientProvider client={client}>
        <UsersView />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  nav.query = "";
  // `Select` (useMediaQuery) uchun: jsdom'da matchMedia yo'q.
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute("open");
  };
});
afterEach(cleanup);

const fill = (template: string, name: string) => template.replace("{name}", name);
const rows = async () => await screen.findAllByTestId("user-row");

describe("UsersView", () => {
  it("jadval: ism, email, rol, holat; asosiy admin va o'zingiz belgilanadi", async () => {
    setup();
    const list = await rows();
    expect(list).toHaveLength(4);
    expect(within(list[0]).getByText(t.envBadge)).toBeTruthy();
    expect(within(list[1]).getByText(t.selfBadge)).toBeTruthy();
    expect(within(list[3]).getByText(t.status.blocked)).toBeTruthy();
    expect(within(list[2]).getByText("ali@example.com")).toBeTruthy();
  });

  it("asosiy admin va o'z qatori uchun amallar o'chirilgan", async () => {
    setup();
    const [env, me, ali] = await rows();
    for (const row of [env, me]) {
      for (const button of within(row).getAllByRole("button")) {
        expect((button as HTMLButtonElement).disabled).toBe(true);
      }
    }
    for (const button of within(ali).getAllByRole("button")) {
      expect((button as HTMLButtonElement).disabled).toBe(false);
    }
  });

  it("bloklash: tasdiqlanmaguncha so'rov ketmaydi", async () => {
    setup();
    await rows();
    fireEvent.click(screen.getByRole("button", { name: fill(t.actions.blockFor, "Ali") }));
    expect(api.updateUser).not.toHaveBeenCalled();
    expect(await screen.findByText(t.blockDialog.title)).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: t.actions.block }).at(-1)!);
    await waitFor(() => expect(api.updateUser).toHaveBeenCalledWith("ali", { is_active: false }));
  });

  it("blokdan chiqarish bloklangan foydalanuvchi uchun", async () => {
    setup();
    await rows();
    fireEvent.click(screen.getByRole("button", { name: fill(t.actions.unblockFor, "Bad") }));
    fireEvent.click(screen.getAllByRole("button", { name: t.actions.unblock }).at(-1)!);
    await waitFor(() => expect(api.updateUser).toHaveBeenCalledWith("bad", { is_active: true }));
  });

  it("o'chirish tasdiqlanadi; backend xatosi dialogda ko'rsatiladi", async () => {
    setup();
    api.deleteUser.mockRejectedValue(new ApiError("x", 409, { code: "last_admin" }));
    await rows();
    fireEvent.click(screen.getByRole("button", { name: fill(t.actions.deleteFor, "Ali") }));
    expect(api.deleteUser).not.toHaveBeenCalled();
    fireEvent.click(screen.getAllByRole("button", { name: t.actions.delete }).at(-1)!);
    await waitFor(() => expect(api.deleteUser).toHaveBeenCalledWith("ali"));
    expect(await screen.findByText(uz.admin.errors.codes.last_admin)).toBeTruthy();
  });

  it("rolni o'zgartirish: yangi rol tanlanmaguncha tugma o'chiq", async () => {
    setup();
    await rows();
    fireEvent.click(screen.getByRole("button", { name: fill(t.actions.roleFor, "Ali") }));
    const form = await screen.findByTestId("role-form");
    const confirm = within(form).getByRole("button", {
      name: t.role.confirm.replace("{role}", uz.admin.roles.student),
    }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
  });

  it("yaratish: parolsiz yuboriladi va noto'g'ri email yuborilmaydi", async () => {
    setup();
    await rows();
    fireEvent.click(screen.getByRole("button", { name: t.new }));
    const form = await screen.findByTestId("user-form");
    fireEvent.click(within(form).getByRole("button", { name: uz.admin.common.create }));
    expect(await within(form).findAllByText(uz.admin.validation.required)).not.toHaveLength(0);
    expect(api.createUser).not.toHaveBeenCalled();

    fireEvent.change(within(form).getByLabelText(t.create.email), {
      target: { value: "new@example.com" },
    });
    fireEvent.click(within(form).getByRole("button", { name: uz.admin.common.create }));
    await waitFor(() =>
      expect(api.createUser).toHaveBeenCalledWith({
        email: "new@example.com",
        role: "student",
        display_name: undefined,
        password: undefined,
      }),
    );
  });

  it("vaqtinchalik parol bir marta ko'rsatiladi", async () => {
    setup();
    api.createUser.mockResolvedValue({ ...USERS[2], temporary_password: "Temp-Pass-123" });
    await rows();
    fireEvent.click(screen.getByRole("button", { name: t.new }));
    const form = await screen.findByTestId("user-form");
    fireEvent.change(within(form).getByLabelText(t.create.email), {
      target: { value: "new@example.com" },
    });
    fireEvent.click(within(form).getByRole("button", { name: uz.admin.common.create }));
    const created = await screen.findByTestId("user-created");
    expect(
      (within(created).getByLabelText(t.create.temporaryPassword) as HTMLInputElement).value,
    ).toBe("Temp-Pass-123");
  });

  it("email band bo'lsa maydon xatosi ko'rsatiladi", async () => {
    setup();
    api.createUser.mockRejectedValue(
      new ApiError("x", 400, { code: "validation_error", details: { email: ["email_taken"] } }),
    );
    await rows();
    fireEvent.click(screen.getByRole("button", { name: t.new }));
    const form = await screen.findByTestId("user-form");
    fireEvent.change(within(form).getByLabelText(t.create.email), {
      target: { value: "ali@example.com" },
    });
    fireEvent.click(within(form).getByRole("button", { name: uz.admin.common.create }));
    expect(await within(form).findByText(uz.admin.errors.fields.email_taken)).toBeTruthy();
  });

  it("filtr URL'ga yoziladi va so'rovga uzatiladi", async () => {
    nav.query = "role=teacher&status=blocked&q=ali&page=2";
    setup();
    await rows();
    expect(api.users).toHaveBeenCalledWith({
      page: 2,
      search: "ali",
      role: "teacher",
      status: "blocked",
    });
  });

  it("bo'sh natija: filtr bilan va filtrsiz alohida matn", async () => {
    nav.query = "role=admin";
    setup([]);
    expect(await screen.findByText(t.emptyFiltered)).toBeTruthy();
  });

  it("so'rov xatosi: qayta urinish tugmasi", async () => {
    api.users.mockRejectedValue(new ApiError("x", 500, { code: "server_error" }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <NextIntlClientProvider locale="uz" messages={uz}>
        <QueryClientProvider client={client}>
          <UsersView />
        </QueryClientProvider>
      </NextIntlClientProvider>,
    );
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("button", { name: uz.admin.common.retry })).toBeTruthy();
  });
});
