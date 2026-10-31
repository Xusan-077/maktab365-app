"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAdminIdentity } from "@/components/admin/AdminRoleProvider";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { QueryError } from "@/components/admin/QueryError";
import { useAdminErrorText } from "@/components/admin/useAdminErrorText";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/hooks/useToast";
import { canDelete } from "@/lib/admin/permissions";
import { ADMIN_ROUTES, adminLibraryBookPath } from "@/lib/admin/routes";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { getAdminLibraryApi, type AdminBookInput } from "@/lib/library/admin-api";
import { libraryKeys, libraryQueries } from "@/lib/library/admin-queries";
import { EMPTY_LIBRARY_BOOK, toFormValues } from "@/lib/validation/library-book";
import { LibraryDetailsForm } from "./LibraryDetailsForm";
import { LibraryFileCard } from "./LibraryFileCard";
import { LibraryCoverCard, LibraryPublishCard } from "./LibrarySideCards";
import { LibraryStatusBadge } from "./LibraryStatus";

const LAYOUT = "grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]";

function BackLink() {
  const t = useTranslations("admin.library.form");
  return (
    <Link
      href={ADMIN_ROUTES.library}
      className="text-link inline-flex min-h-11 items-center gap-1.5 text-sm font-medium hover:underline"
    >
      <ArrowLeft className="size-4" aria-hidden />
      {t("back")}
    </Link>
  );
}

/** Yangi kitob: avval ma'lumotlar, saqlangach tahrirlash sahifasida PDF yuklanadi. */
export function LibraryCreateView() {
  const t = useTranslations("admin.library.form");
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  async function create(payload: AdminBookInput) {
    const book = await getAdminLibraryApi().create(payload);
    await queryClient.invalidateQueries({ queryKey: libraryKeys.root });
    toast({ variant: "success", title: t("created") });
    router.push(adminLibraryBookPath(book.id));
  }

  return (
    <div className="flex flex-col gap-6">
      <BackLink />
      <PageHeader title={t("newTitle")} />
      <div className="max-w-3xl">
        <LibraryDetailsForm
          initial={EMPTY_LIBRARY_BOOK}
          submitLabel={t("saveAndContinue")}
          onSubmit={create}
        />
      </div>
    </div>
  );
}

/** Kitobni tahrirlash: ma'lumotlar + mundarija, PDF, muqova, nashr va o'chirish. */
export function LibraryEditView({ id }: { id: string }) {
  const t = useTranslations("admin.library");
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const errorText = useAdminErrorText();
  const { role } = useAdminIdentity();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const query = useQuery(libraryQueries.book(id));
  const book = query.data;

  const remove = useMutation({
    mutationFn: () => getAdminLibraryApi().remove(id),
    onSuccess: () => {
      toast({ variant: "success", title: t("delete.done") });
      void queryClient.invalidateQueries({ queryKey: libraryKeys.root });
      router.push(ADMIN_ROUTES.library);
    },
  });

  async function save(payload: AdminBookInput) {
    await getAdminLibraryApi().update(id, payload);
    await queryClient.invalidateQueries({ queryKey: libraryKeys.root });
    toast({ variant: "success", title: t("form.saved") });
  }

  if (query.isError) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink />
        <QueryError error={query.error} onRetry={() => void query.refetch()} />
      </div>
    );
  }
  if (!book) {
    return (
      <div className="flex flex-col gap-4" aria-busy>
        <Skeleton className="h-8 w-48" />
        <div className={LAYOUT}>
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <BackLink />
      <PageHeader
        title={book.title || t("untitled")}
        description={<LibraryStatusBadge book={book} />}
      />
      <div className={LAYOUT}>
        {/* Forma boshlang'ich qiymat bilan bir marta quriladi: holat so'rovi (polling) yozilayotgan matnni o'chirmaydi. */}
        <LibraryDetailsForm
          key={book.id}
          initial={toFormValues(book)}
          submitLabel={t("form.save")}
          onSubmit={save}
        />
        <aside className="flex flex-col gap-4" aria-label={t("form.editTitle")}>
          <LibraryFileCard book={book} />
          <LibraryCoverCard book={book} />
          <LibraryPublishCard book={book} />
          {canDelete(role) && (
            <Button
              variant="ghost"
              className="text-danger self-start"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="size-4" aria-hidden />
              {t("delete.button")}
            </Button>
          )}
        </aside>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t("delete.title")}
        description={t("delete.description", { title: book.title })}
        confirmLabel={t("delete.confirm")}
        onConfirm={() => remove.mutate()}
        pending={remove.isPending}
        error={remove.isError ? errorText(remove.error) : undefined}
      />
    </div>
  );
}
