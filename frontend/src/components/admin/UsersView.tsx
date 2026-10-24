"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, CircleCheck, Search, ShieldCheck, Trash2, UserPlus, Users } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { listItem, m } from "@/components/ui/motion";
import { Select, type SelectOption } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/hooks/useToast";
import { getAdminApi } from "@/lib/admin/api";
import { ADMIN_ROOT_KEY, adminQueries } from "@/lib/admin/queries";
import { PAGE_SIZE, type AdminUser, type UserListParams } from "@/lib/admin/types";
import {
  parseUserParams,
  serializeUserParams,
  USER_ROLES,
  USER_STATUSES,
  withUserFilter,
} from "@/lib/admin/user-params";
import type { Locale } from "@/lib/i18n/config";
import { usePathname, useRouter } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils/cn";
import { formatDate } from "@/lib/utils/format-date";
import { useAdminIdentity } from "./AdminRoleProvider";
import { ConfirmDialog } from "./ConfirmDialog";
import { Pagination } from "./Pagination";
import { QueryError } from "./QueryError";
import { CreateUserDialog, RoleDialog } from "./UserDialogs";
import { useAdminErrorText } from "./useAdminErrorText";
import { useDebouncedSearch } from "./useDebouncedSearch";

const ALL = "all";
const iconButton =
  "text-muted hover:bg-subtle hover:text-foreground inline-flex size-11 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent sm:size-10";

type Dialog =
  | { kind: "create" }
  | { kind: "role"; user: AdminUser }
  | { kind: "block"; user: AdminUser }
  | { kind: "delete"; user: AdminUser }
  | null;

function Filters({
  params,
  update,
}: {
  params: UserListParams;
  update: (patch: Partial<UserListParams>) => void;
}) {
  const t = useTranslations("admin.users");
  const tr = useTranslations("admin.roles");
  const [search, setSearch] = useDebouncedSearch(params.search, (value) =>
    update({ search: value }),
  );
  const roleOptions: SelectOption[] = [
    { value: ALL, label: t("filters.allRoles") },
    ...USER_ROLES.map((role) => ({ value: role, label: tr(role) })),
  ];
  const statusOptions: SelectOption[] = [
    { value: ALL, label: t("filters.allStatuses") },
    ...USER_STATUSES.map((status) => ({ value: status, label: t(`status.${status}`) })),
  ];

  return (
    <div role="search" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div className="relative">
        <Search
          className="text-muted pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden
        />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label={t("search")}
          placeholder={t("search")}
          className="border-border bg-surface text-foreground placeholder:text-muted hover:border-primary-300 h-10 w-full rounded-lg border pr-3 pl-9 text-sm shadow-xs transition-colors"
        />
      </div>
      <Select
        aria-label={t("filters.role")}
        value={params.role ?? ALL}
        options={roleOptions}
        searchable={false}
        onChange={(value) => update({ role: USER_ROLES.find((role) => role === value) })}
      />
      <Select
        aria-label={t("filters.status")}
        value={params.status ?? ALL}
        options={statusOptions}
        searchable={false}
        onChange={(value) => update({ status: USER_STATUSES.find((status) => status === value) })}
      />
    </div>
  );
}

function UserRow({
  user,
  index,
  isSelf,
  onDialog,
}: {
  user: AdminUser;
  index: number;
  isSelf: boolean;
  onDialog: (dialog: Dialog) => void;
}) {
  const t = useTranslations("admin.users");
  const tr = useTranslations("admin.roles");
  const locale = useLocale() as Locale;
  const label = user.display_name || user.email || "";
  const envProtected = user.is_env_admin;
  const lockedReason = envProtected ? t("protected.env") : isSelf ? t("protected.self") : undefined;

  return (
    <m.tr
      variants={listItem}
      initial="hidden"
      animate="show"
      custom={index}
      data-testid="user-row"
      className={cn(!user.is_active && "bg-subtle/50")}
    >
      <td className="px-4 py-3">
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{user.display_name || "—"}</span>
          <span className="text-muted truncate text-xs">{user.email ?? t("noEmail")}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span>{tr(user.role)}</span>
          {envProtected && <Badge variant="accent">{t("envBadge")}</Badge>}
          {isSelf && !envProtected && <Badge variant="neutral">{t("selfBadge")}</Badge>}
        </div>
      </td>
      <td className="text-muted px-4 py-3 whitespace-nowrap">
        {formatDate(user.date_joined, locale, "date")}
      </td>
      <td className="px-4 py-3">
        <Badge variant={user.is_active ? "success" : "danger"}>
          {t(user.is_active ? "status.active" : "status.blocked")}
        </Badge>
      </td>
      <td className="px-4 py-2">
        <div className="flex justify-end gap-0.5">
          <button
            type="button"
            className={iconButton}
            disabled={Boolean(lockedReason)}
            title={lockedReason ?? t("actions.role")}
            aria-label={t("actions.roleFor", { name: label })}
            onClick={() => onDialog({ kind: "role", user })}
          >
            <ShieldCheck className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            className={iconButton}
            disabled={Boolean(lockedReason)}
            title={lockedReason ?? t(user.is_active ? "actions.block" : "actions.unblock")}
            aria-label={t(user.is_active ? "actions.blockFor" : "actions.unblockFor", {
              name: label,
            })}
            onClick={() => onDialog({ kind: "block", user })}
          >
            {user.is_active ? (
              <Ban className="size-5" aria-hidden />
            ) : (
              <CircleCheck className="size-5" aria-hidden />
            )}
          </button>
          <button
            type="button"
            className={cn(iconButton, "hover:text-danger")}
            disabled={Boolean(lockedReason)}
            title={lockedReason ?? t("actions.delete")}
            aria-label={t("actions.deleteFor", { name: label })}
            onClick={() => onDialog({ kind: "delete", user })}
          >
            <Trash2 className="size-5" aria-hidden />
          </button>
        </div>
      </td>
    </m.tr>
  );
}

/** Foydalanuvchilar: qidiruv, filtr, qo'shish, rol, bloklash, o'chirish (har amal tasdiqlanadi). */
export function UsersView() {
  const t = useTranslations("admin.users");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { email: myEmail } = useAdminIdentity();
  const errorText = useAdminErrorText();
  const params = useMemo(() => parseUserParams(searchParams), [searchParams]);
  const { data, error, isPending, refetch } = useQuery(adminQueries.users(params));
  const [dialog, setDialog] = useState<Dialog>(null);

  const navigate = (next: UserListParams) => {
    const query = serializeUserParams(next);
    router.replace(query ? `${pathname}?${query}` : pathname);
  };
  const update = (patch: Partial<UserListParams>) => navigate(withUserFilter(params, patch));
  const filtered = Boolean(params.search || params.role || params.status);

  const done = async (message: string) => {
    await queryClient.invalidateQueries({ queryKey: ADMIN_ROOT_KEY });
    toast({ variant: "success", title: message });
    setDialog(null);
  };
  const toggleBlock = useMutation({
    mutationFn: (user: AdminUser) =>
      getAdminApi().updateUser(user.id, { is_active: !user.is_active }),
    onSuccess: (saved) => done(t(saved.is_active ? "toast.unblocked" : "toast.blocked")),
  });
  const remove = useMutation({
    mutationFn: (user: AdminUser) => getAdminApi().deleteUser(user.id),
    onSuccess: () => done(t("toast.deleted")),
  });

  const openDialog = (next: Dialog) => {
    toggleBlock.reset();
    remove.reset();
    setDialog(next);
  };
  const blockTarget = dialog?.kind === "block" ? dialog.user : null;
  const deleteTarget = dialog?.kind === "delete" ? dialog.user : null;

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("description")}
        action={
          <Button onClick={() => openDialog({ kind: "create" })}>
            <UserPlus className="size-4" aria-hidden />
            {t("new")}
          </Button>
        }
      />
      <Filters params={params} update={update} />

      {error ? (
        <QueryError error={error} onRetry={() => void refetch()} />
      ) : isPending ? (
        <div role="status" aria-label={t("loading")} className="flex flex-col gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : data.results.length === 0 ? (
        <EmptyState
          icon={Users}
          action={
            filtered ? undefined : (
              <Button onClick={() => openDialog({ kind: "create" })}>{t("new")}</Button>
            )
          }
        >
          {filtered ? t("emptyFiltered") : t("empty")}
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="border-border bg-surface overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[44rem] text-sm">
              <caption className="sr-only">{t("title")}</caption>
              <thead className="bg-subtle text-muted">
                <tr>
                  {(["user", "role", "joined", "status"] as const).map((column) => (
                    <th key={column} scope="col" className="px-4 py-2.5 text-left font-medium">
                      {t(`columns.${column}`)}
                    </th>
                  ))}
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">
                    {t("columns.actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {data.results.map((user, index) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    index={index}
                    isSelf={
                      Boolean(myEmail) && user.email?.toLowerCase() === myEmail?.toLowerCase()
                    }
                    onDialog={openDialog}
                  />
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={params.page ?? 1}
            pageSize={PAGE_SIZE}
            total={data.count}
            onPageChange={(page) => navigate({ ...params, page })}
          />
        </div>
      )}

      <CreateUserDialog
        open={dialog?.kind === "create"}
        onOpenChange={(open) => !open && setDialog(null)}
      />
      <RoleDialog
        user={dialog?.kind === "role" ? dialog.user : null}
        onClose={() => setDialog(null)}
      />
      <ConfirmDialog
        open={blockTarget !== null}
        onOpenChange={(open) => !open && setDialog(null)}
        title={t(blockTarget?.is_active === false ? "unblockDialog.title" : "blockDialog.title")}
        description={t(
          blockTarget?.is_active === false
            ? "unblockDialog.description"
            : "blockDialog.description",
          { email: blockTarget?.email ?? "" },
        )}
        confirmLabel={t(blockTarget?.is_active === false ? "actions.unblock" : "actions.block")}
        pending={toggleBlock.isPending}
        error={toggleBlock.isError ? errorText(toggleBlock.error) : undefined}
        onConfirm={() => blockTarget && toggleBlock.mutate(blockTarget)}
      />
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDialog(null)}
        title={t("deleteDialog.title")}
        description={t("deleteDialog.description", { email: deleteTarget?.email ?? "" })}
        confirmLabel={t("actions.delete")}
        pending={remove.isPending}
        error={remove.isError ? errorText(remove.error) : undefined}
        onConfirm={() => deleteTarget && remove.mutate(deleteTarget)}
      />
    </>
  );
}
