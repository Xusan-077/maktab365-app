"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Library, Pencil, Plus, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/hooks/useToast";
import { getAdminApi } from "@/lib/admin/api";
import { canDelete } from "@/lib/admin/permissions";
import { ADMIN_ROOT_KEY, adminQueries } from "@/lib/admin/queries";
import type { AdminSubject } from "@/lib/admin/types";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { useAdminIdentity } from "./AdminRoleProvider";
import { ConfirmDialog } from "./ConfirmDialog";
import { QueryError } from "./QueryError";
import { SubjectDialog } from "./SubjectDialog";
import { useAdminErrorText } from "./useAdminErrorText";

type Editing = { kind: "create" } | { kind: "edit"; subject: AdminSubject } | null;

/** Fanlar: ro'yxat, qo'shish, nomini tahrirlash, o'chirish (kitobi bor fan o'chirilmaydi). */
export function SubjectsView() {
  const t = useTranslations("admin.subjects");
  const tc = useTranslations("admin.common");
  const locale = useLocale() as Locale;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { role } = useAdminIdentity();
  const errorText = useAdminErrorText();
  const { data, error, isPending, refetch } = useQuery(adminQueries.subjects());
  const [editing, setEditing] = useState<Editing>(null);
  const [deleting, setDeleting] = useState<AdminSubject | null>(null);

  const remove = useMutation({
    mutationFn: (subject: AdminSubject) => getAdminApi().deleteSubject(subject.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ADMIN_ROOT_KEY });
      toast({ variant: "success", title: t("deleted") });
      setDeleting(null);
    },
  });

  const nextOrder = Math.max(0, ...(data ?? []).map((s) => s.order ?? 0)) + 1;
  const addButton = (
    <Button onClick={() => setEditing({ kind: "create" })}>
      <Plus className="size-4" aria-hidden />
      {t("new")}
    </Button>
  );

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} action={addButton} />

      {error ? (
        <QueryError error={error} onRetry={() => void refetch()} />
      ) : isPending ? (
        <div role="status" aria-label={t("loading")} className="flex flex-col gap-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <EmptyState icon={Library} action={addButton}>
          {t("empty")}
        </EmptyState>
      ) : (
        <div className="border-border bg-surface overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[32rem] text-sm" data-testid="subjects-table">
            <caption className="sr-only">{t("title")}</caption>
            <thead className="bg-subtle text-muted">
              <tr>
                {(["name", "slug", "books"] as const).map((column) => (
                  <th key={column} scope="col" className="px-4 py-2.5 text-left font-medium">
                    {t(`columns.${column}`)}
                  </th>
                ))}
                <th scope="col" className="px-4 py-2.5 text-right font-medium">
                  <span className="sr-only">{t("columns.actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {data.map((subject) => {
                const name = getLocalized(subject.title, locale);
                const hasBooks = subject.pdf_books_count > 0;
                return (
                  <tr key={subject.id} className="hover:bg-subtle/60">
                    <td className="px-4 py-3 font-medium">{name}</td>
                    <td className="text-muted px-4 py-3">{subject.slug}</td>
                    <td className="px-4 py-3 tabular-nums">{subject.pdf_books_count}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          aria-label={t("editLabel", { name })}
                          onClick={() => setEditing({ kind: "edit", subject })}
                        >
                          <Pencil className="size-4" aria-hidden />
                        </Button>
                        {canDelete(role) && (
                          <Button
                            variant="ghost"
                            aria-label={t("deleteLabel", { name })}
                            title={hasBooks ? t("hasBooks") : undefined}
                            disabled={hasBooks}
                            onClick={() => {
                              remove.reset();
                              setDeleting(subject);
                            }}
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <SubjectDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        subject={editing?.kind === "edit" ? editing.subject : undefined}
        nextOrder={nextOrder}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={t("deleteTitle")}
        description={t("deleteDescription", {
          name: deleting ? getLocalized(deleting.title, locale) : "",
        })}
        confirmLabel={tc("delete")}
        pending={remove.isPending}
        error={remove.isError ? errorText(remove.error) : undefined}
        onConfirm={() => deleting && remove.mutate(deleting)}
      />
    </>
  );
}
