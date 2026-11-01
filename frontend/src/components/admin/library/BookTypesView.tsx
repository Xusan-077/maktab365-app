"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { LocalizedFields, toLocalized } from "@/components/admin/LocalizedFields";
import { QueryError } from "@/components/admin/QueryError";
import { useAdminErrorText } from "@/components/admin/useAdminErrorText";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button, buttonVariants } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { ADMIN_ROUTES } from "@/lib/admin/routes";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { Link } from "@/lib/i18n/navigation";
import { getAdminLibraryApi, type AdminBookTypeRow } from "@/lib/library/admin-api";
import { libraryKeys, libraryQueries } from "@/lib/library/admin-queries";
import type { LocalizedText } from "@/types/i18n";

interface FormState {
  name: LocalizedText;
  order: string;
  active: boolean;
}

function TypeForm({ type, onDone }: { type?: AdminBookTypeRow; onDone: () => void }) {
  const t = useTranslations("admin.library.types");
  const tc = useTranslations("admin.common");
  const errorText = useAdminErrorText();
  const queryClient = useQueryClient();
  const [state, setState] = useState<FormState>({
    name: { uz: type?.name.uz ?? "", ru: type?.name.ru ?? "", en: type?.name.en ?? "" },
    order: String(type?.order ?? 50),
    active: type?.is_active ?? true,
  });
  const [touched, setTouched] = useState(false);
  const nameMissing = state.name.uz.trim() === "";

  const save = useMutation({
    mutationFn: () => {
      const api = getAdminLibraryApi();
      const body = {
        name: toLocalized(state.name),
        order: Number(state.order) || 0,
        is_active: state.active,
      };
      return type ? api.updateType(type.id, body) : api.createType(body);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: libraryKeys.root });
      onDone();
    },
  });

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        setTouched(true);
        if (!nameMissing) save.mutate();
      }}
    >
      <LocalizedFields
        label={t("name")}
        name="book-type-name"
        value={state.name}
        onChange={(name) => setState((current) => ({ ...current, name }))}
        error={touched && nameMissing ? t("nameRequired") : undefined}
      />
      <Input
        type="number"
        min={0}
        label={t("order")}
        hint={t("orderHint")}
        value={state.order}
        onChange={(event) => setState((current) => ({ ...current, order: event.target.value }))}
      />
      <Switch
        checked={state.active}
        onCheckedChange={(active) => setState((current) => ({ ...current, active }))}
        label={t("active")}
        description={t("activeHint")}
        disabled={type?.is_system}
      />
      {save.isError && (
        <p role="alert" className="text-danger text-sm">
          {errorText(save.error)}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>
          {tc("cancel")}
        </Button>
        <Button type="submit" loading={save.isPending}>
          {type ? tc("save") : tc("create")}
        </Button>
      </div>
    </form>
  );
}

/** Kutubxona turlari: ro'yxat, qo'shish, tahrirlash, bo'sh turni o'chirish. */
export function BookTypesView() {
  const t = useTranslations("admin.library.types");
  const tc = useTranslations("admin.common");
  const locale = useLocale() as Locale;
  const queryClient = useQueryClient();
  const errorText = useAdminErrorText();
  const query = useQuery(libraryQueries.types());
  const [editing, setEditing] = useState<AdminBookTypeRow | "new" | null>(null);
  const [removing, setRemoving] = useState<AdminBookTypeRow | null>(null);

  const remove = useMutation({
    mutationFn: (id: string) => getAdminLibraryApi().removeType(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: libraryKeys.root });
      setRemoving(null);
    },
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("title")}
        description={t("description")}
        action={
          <div className="flex flex-wrap gap-2">
            <Link href={ADMIN_ROUTES.library} className={buttonVariants({ variant: "ghost" })}>
              {t("back")}
            </Link>
            <Button onClick={() => setEditing("new")}>
              <Plus className="size-4" aria-hidden />
              {t("add")}
            </Button>
          </div>
        }
      />

      {query.isError ? (
        <QueryError error={query.error} onRetry={() => void query.refetch()} />
      ) : !query.data ? (
        <Skeleton className="h-40 w-full rounded-xl" aria-busy />
      ) : (
        <ul className="flex flex-col gap-3">
          {query.data.map((type) => (
            <li
              key={type.id}
              className="border-border bg-surface flex items-center gap-3 rounded-xl border p-3 sm:p-4"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex items-center gap-2 font-semibold">
                  {getLocalized(type.name, locale)}
                  {type.is_system && (
                    <Lock className="text-muted size-4" aria-label={t("system")} />
                  )}
                </span>
                <span className="text-muted text-sm tabular-nums">
                  {t("meta", { count: type.book_count, order: type.order ?? 0 })}
                  {type.is_active === false && ` · ${t("inactive")}`}
                </span>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setEditing(type)}
                aria-label={`${tc("edit")}: ${getLocalized(type.name, locale)}`}
              >
                <Pencil className="size-4" aria-hidden />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={type.is_system || type.book_count > 0}
                title={type.is_system ? t("systemHint") : undefined}
                onClick={() => setRemoving(type)}
                aria-label={`${tc("delete")}: ${getLocalized(type.name, locale)}`}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing === "new" ? t("createTitle") : t("editTitle")}
      >
        {editing !== null && (
          <TypeForm
            type={editing === "new" ? undefined : editing}
            onDone={() => setEditing(null)}
          />
        )}
      </Dialog>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={t("deleteTitle")}
        description={t("deleteText", {
          name: removing ? getLocalized(removing.name, locale) : "",
        })}
        confirmLabel={tc("delete")}
        pending={remove.isPending}
        error={remove.isError ? errorText(remove.error) : undefined}
        onConfirm={() => removing && remove.mutate(removing.id)}
      />
    </div>
  );
}
