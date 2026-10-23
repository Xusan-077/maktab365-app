"use client";

import { useMemo, useState } from "react";
import { yupResolver } from "@hookform/resolvers/yup";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/hooks/useToast";
import { getAdminApi } from "@/lib/admin/api";
import type { PdfFileProblem } from "@/lib/admin/pdf-file";
import { canDelete } from "@/lib/admin/permissions";
import { ADMIN_ROOT_KEY, adminQueries } from "@/lib/admin/queries";
import { ADMIN_ROUTES } from "@/lib/admin/routes";
import type { AdminPdfBook, PdfBookStatus } from "@/lib/admin/types";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { formatBytes } from "@/lib/utils/bytes";
import { createPdfBookSchema } from "@/lib/validation/admin";
import { GRADES } from "@/types/catalog";
import type { LocalizedText } from "@/types/i18n";
import { chapterProblems, fromApi } from "@/lib/admin/chapters";
import { useAdminIdentity } from "./AdminRoleProvider";
import { BookDetailsFields, toDetailsPatch, type BookDetailsValue } from "./BookDetailsFields";
import { ConfirmDialog } from "./ConfirmDialog";
import { LocalizedFields, toLocalized } from "./LocalizedFields";
import { PdfFilePicker } from "./PdfFilePicker";
import { QueryError } from "./QueryError";
import { BookStatusBadge } from "./StatusBadge";
import { useAdminErrorText, useAdminFieldErrorText } from "./useAdminErrorText";
import { usePdfUpload } from "./usePdfUpload";

interface FormValues {
  grade: string;
  subject: string;
  title: LocalizedText;
}

function Details({ book }: { book: AdminPdfBook }) {
  const t = useTranslations("admin.pdfEdit");
  const locale = useLocale() as Locale;
  const rows: [string, string][] = [
    [t("info.pages"), book.has_file ? String(book.page_count) : "—"],
    [t("info.size"), book.has_file ? formatBytes(book.size_bytes) : "—"],
    [t("info.updated"), new Date(book.updated_at).toLocaleString(locale)],
  ];
  return (
    <dl className="grid gap-3 sm:grid-cols-3" data-testid="pdf-details">
      {rows.map(([label, value]) => (
        <div key={label} className="border-border bg-surface rounded-lg border p-3">
          <dt className="text-muted text-xs">{label}</dt>
          <dd className="font-medium tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function PublishActions({ book }: { book: AdminPdfBook }) {
  const t = useTranslations("admin.pdfEdit");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const errorText = useAdminErrorText();
  const move = useMutation({
    mutationFn: (to: PdfBookStatus) => getAdminApi().transitionPdfBook(book.id, to),
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ADMIN_ROOT_KEY });
      toast({
        variant: "success",
        title: t(saved.status === "published" ? "published" : "unpublished"),
      });
    },
    onError: (error) => toast({ variant: "error", title: errorText(error) }),
  });
  const targets = book.allowed_transitions.filter(
    (to): to is PdfBookStatus => to === "draft" || to === "published",
  );
  if (targets.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {targets.map((to) => (
        <Button
          key={to}
          variant={to === "published" ? "primary" : "ghost"}
          loading={move.isPending && move.variables === to}
          disabled={move.isPending || (to === "published" && !book.has_file)}
          onClick={() => move.mutate(to)}
        >
          {t(to === "published" ? "publish" : "unpublish")}
        </Button>
      ))}
      {!book.has_file && book.status === "draft" && (
        <p className="text-muted text-sm">{t("publishNeedsFile")}</p>
      )}
    </div>
  );
}

function ReplaceFile({ book }: { book: AdminPdfBook }) {
  const t = useTranslations("admin.pdfEdit");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const errorText = useAdminErrorText();
  const upload = usePdfUpload();
  const [file, setFile] = useState<File | null>(null);
  const [problem, setProblem] = useState<PdfFileProblem | null>(null);

  const replace = useMutation({
    mutationFn: () => upload.run(book.id, file!),
    onSuccess: async ({ coverFailed }) => {
      await queryClient.invalidateQueries({ queryKey: ADMIN_ROOT_KEY });
      setFile(null);
      toast({ variant: "success", title: t("replaced") });
      if (coverFailed) toast({ variant: "info", title: t("coverFailed") });
    },
  });

  return (
    <section className="flex flex-col gap-3" aria-labelledby="pdf-replace">
      <h2 id="pdf-replace" className="text-lg font-semibold">
        {t(book.has_file ? "replaceTitle" : "uploadTitle")}
      </h2>
      <PdfFilePicker
        label={t("fileLabel")}
        file={file}
        problem={problem}
        upload={upload.state}
        onCancel={upload.cancel}
        hasExisting={book.has_file}
        disabled={replace.isPending}
        onChange={(chosen, found) => {
          setFile(chosen);
          setProblem(found);
          replace.reset();
        }}
      />
      {replace.isError && (
        <p role="alert" className="text-danger text-sm">
          {errorText(replace.error)}
        </p>
      )}
      <div>
        <Button
          loading={replace.isPending}
          disabled={!file || Boolean(problem)}
          onClick={() => replace.mutate()}
        >
          {t(book.has_file ? "replaceAction" : "uploadAction")}
        </Button>
      </div>
    </section>
  );
}

/** Tavsif va mundarija: asosiy ma'lumotlardan alohida saqlanadi (bet raqamlari PDF bo'yicha tekshiriladi). */
function PdfBookDetailsForm({ book }: { book: AdminPdfBook }) {
  const t = useTranslations("admin.details");
  const tc = useTranslations("admin.common");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const errorText = useAdminErrorText();
  const fieldErrorText = useAdminFieldErrorText();
  const initial = useMemo<BookDetailsValue>(
    () => ({ description: book.description ?? "", chapters: fromApi(book.chapters ?? []) }),
    [book],
  );
  const [value, setValue] = useState(initial);
  const [showProblems, setShowProblems] = useState(false);
  const pageCount = book.has_file ? book.page_count : undefined;

  const patch = toDetailsPatch(value);
  const dirty = JSON.stringify(patch) !== JSON.stringify(toDetailsPatch(initial));

  const save = useMutation({
    mutationFn: () => getAdminApi().updatePdfBook(book.id, patch),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ADMIN_ROOT_KEY });
      toast({ variant: "success", title: t("saved") });
    },
  });
  const chaptersError = save.isError
    ? (fieldErrorText(save.error, "chapters") ?? errorText(save.error))
    : undefined;

  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      aria-labelledby="pdf-details-heading"
      data-testid="pdf-details-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (chapterProblems(value.chapters, pageCount).size > 0) {
          setShowProblems(true);
          return;
        }
        save.mutate();
      }}
    >
      <h2 id="pdf-details-heading" className="text-lg font-semibold">
        {t("heading")}
      </h2>
      <BookDetailsFields
        value={value}
        onChange={(next) => {
          setValue(next);
          save.reset();
        }}
        pageCount={pageCount}
        disabled={save.isPending}
        showProblems={showProblems}
        chaptersError={chaptersError}
      />
      <div>
        <Button type="submit" loading={save.isPending} disabled={!dirty}>
          {tc("save")}
        </Button>
      </div>
    </form>
  );
}

function PdfBookForm({ book }: { book: AdminPdfBook }) {
  const t = useTranslations("admin.pdfEdit");
  const tw = useTranslations("admin.pdfWizard");
  const tv = useTranslations("admin.validation");
  const tc = useTranslations("admin.common");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { role } = useAdminIdentity();
  const errorText = useAdminErrorText();
  const { data: subjects } = useQuery(adminQueries.subjects());
  const [confirmOpen, setConfirmOpen] = useState(false);

  const schema = useMemo(() => createPdfBookSchema(), []);
  const {
    control,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: yupResolver(schema) as unknown as Resolver<FormValues>,
    defaultValues: {
      grade: String(book.grade),
      subject: book.subject,
      title: { uz: book.title.uz, ru: book.title.ru ?? "", en: book.title.en ?? "" },
    },
  });

  const save = useMutation({
    mutationFn: (values: FormValues) =>
      getAdminApi().updatePdfBook(book.id, {
        title: toLocalized(values.title),
        grade: Number(values.grade),
        subject: values.subject,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ADMIN_ROOT_KEY });
      toast({ variant: "success", title: t("saved") });
    },
  });
  const remove = useMutation({
    mutationFn: () => getAdminApi().deletePdfBook(book.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ADMIN_ROOT_KEY });
      toast({ variant: "success", title: t("deleted") });
      router.push(ADMIN_ROUTES.pdfBooks);
    },
  });

  const subjectOptions = (subjects ?? []).map((s) => ({
    value: s.slug,
    label: getLocalized(s.title, locale),
  }));
  const gradeOptions = GRADES.map((g) => ({
    value: String(g),
    label: tw("gradeOption", { grade: g }),
  }));

  return (
    <>
      <form
        noValidate
        className="flex flex-col gap-5"
        aria-label={t("formLabel")}
        data-testid="pdf-book-form"
        onSubmit={handleSubmit((values) => save.mutate(values))}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            control={control}
            name="grade"
            render={({ field }) => (
              <Select
                label={tw("gradeLabel")}
                value={field.value}
                onChange={field.onChange}
                options={gradeOptions}
                searchable={false}
              />
            )}
          />
          <Controller
            control={control}
            name="subject"
            render={({ field }) => (
              <Select
                label={tw("subjectLabel")}
                value={field.value}
                onChange={field.onChange}
                options={subjectOptions}
              />
            )}
          />
        </div>
        <Controller
          control={control}
          name="title"
          render={({ field }) => (
            <LocalizedFields
              label={tw("titleLabel")}
              name="pdf-title"
              value={field.value}
              onChange={field.onChange}
              error={errors.title?.uz?.message ? tv(errors.title.uz.message) : undefined}
            />
          )}
        />
        {save.isError && (
          <p role="alert" className="text-danger text-sm">
            {errorText(save.error)}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" loading={save.isPending} disabled={!isDirty}>
            {tc("save")}
          </Button>
          {canDelete(role) && (
            <Button variant="danger" onClick={() => setConfirmOpen(true)}>
              {tc("delete")}
            </Button>
          )}
        </div>
      </form>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("deleteTitle")}
        description={t("deleteDescription", { title: getLocalized(book.title, locale) })}
        confirmLabel={tc("delete")}
        pending={remove.isPending}
        error={remove.isError ? errorText(remove.error) : undefined}
        onConfirm={() => remove.mutate()}
      />
    </>
  );
}

/** PDF kitob sahifasi: ma'lumot, nashr, fayl almashtirish, tahrirlash va o'chirish. */
export function PdfBookEditView({ id }: { id: string }) {
  const t = useTranslations("admin.pdfEdit");
  const locale = useLocale() as Locale;
  const { data: book, error, isPending, refetch } = useQuery(adminQueries.pdfBook(id));

  if (error) return <QueryError error={error} onRetry={() => void refetch()} />;
  if (isPending) return <Skeleton className="h-96" />;

  return (
    <>
      <PageHeader
        title={getLocalized(book.title, locale)}
        action={<BookStatusBadge published={book.status === "published"} />}
      />
      <Link
        href={ADMIN_ROUTES.pdfBooks}
        className="text-link -mt-4 text-sm font-medium underline-offset-4 hover:underline"
      >
        {t("backToList")}
      </Link>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-start gap-5">
          {book.cover_url && (
            // Backend/R2 manzili (tashqi domen): next/image sozlamasi shart emas.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={book.cover_url}
              alt=""
              data-testid="pdf-cover"
              className="bg-subtle h-40 w-28 rounded-lg object-cover"
            />
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <Details book={book} />
            <PublishActions book={book} />
          </div>
        </div>
        <ReplaceFile key={book.updated_at} book={book} />
        <PdfBookForm key={`form-${book.updated_at}`} book={book} />
        <PdfBookDetailsForm key={`details-${book.updated_at}`} book={book} />
      </div>
    </>
  );
}
