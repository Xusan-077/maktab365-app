"use client";

import { useMemo, useState } from "react";
import { yupResolver } from "@hookform/resolvers/yup";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/hooks/useToast";
import { getAdminApi } from "@/lib/admin/api";
import { fieldErrors } from "@/lib/admin/errors";
import { canDelete } from "@/lib/admin/permissions";
import { ADMIN_ROUTES, adminBookPath } from "@/lib/admin/routes";
import { ADMIN_ROOT_KEY, adminQueries } from "@/lib/admin/queries";
import type { AdminBook } from "@/lib/admin/types";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { useRouter } from "@/lib/i18n/navigation";
import { createBookSchema } from "@/lib/validation/admin";
import { GRADES } from "@/types/catalog";
import type { LocalizedText } from "@/types/i18n";
import { useAdminIdentity } from "./AdminRoleProvider";
import { FileUpload } from "./FileUpload";
import { LocalizedFields, toLocalized } from "./LocalizedFields";
import { useAdminErrorText, useAdminFieldErrorText } from "./useAdminErrorText";

interface BookFormValues {
  slug: string;
  subject: string;
  grade: string;
  title: LocalizedText;
  author: string;
  edition: string;
  publisher: string;
  year: number | string;
  is_published: boolean;
  cover: string;
  pdf: string;
}

const CURRENT_YEAR = new Date().getFullYear();

function defaultsOf(book?: AdminBook): BookFormValues {
  return {
    slug: book?.slug ?? "",
    subject: book?.subject ?? "",
    grade: book ? String(book.grade) : "",
    title: { uz: book?.title.uz ?? "", ru: book?.title.ru ?? "", en: book?.title.en ?? "" },
    author: book?.author.uz ?? "",
    edition: book?.edition.uz ?? "",
    publisher: book?.publisher ?? "",
    year: book?.year ?? CURRENT_YEAR,
    is_published: book?.is_published ?? false,
    cover: book?.cover ?? "",
    pdf: book?.pdf ?? "",
  };
}

/** Kitob yaratish/tahrirlash formasi (muqova va PDF yuklash bilan). */
export function BookForm({ book }: { book?: AdminBook }) {
  const t = useTranslations("admin.bookForm");
  const tv = useTranslations("admin.validation");
  const tc = useTranslations("admin.common");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { role } = useAdminIdentity();
  const errorText = useAdminErrorText();
  const fieldErrorText = useAdminFieldErrorText();
  const { data: subjects } = useQuery(adminQueries.subjects());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [urls, setUrls] = useState({
    cover: book?.cover_url ?? null,
    pdf: book?.pdf_url ?? null,
  });

  const schema = useMemo(() => createBookSchema(), []);
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isDirty },
  } = useForm<BookFormValues>({
    resolver: yupResolver(schema) as unknown as Resolver<BookFormValues>,
    defaultValues: defaultsOf(book),
  });

  const msg = (message?: string) => (message ? tv(message) : undefined);

  const save = useMutation({
    mutationFn: (values: BookFormValues) => {
      const body = {
        subject: values.subject,
        grade: Number(values.grade),
        title: toLocalized(values.title),
        author: { uz: values.author.trim() },
        edition: { uz: values.edition.trim() },
        publisher: values.publisher.trim(),
        year: Number(values.year),
        is_published: values.is_published,
        cover: values.cover,
        pdf: values.pdf,
      };
      const api = getAdminApi();
      return book ? api.updateBook(book.id, body) : api.createBook({ slug: values.slug, ...body });
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ADMIN_ROOT_KEY });
      toast({ variant: "success", title: t(book ? "saved" : "created") });
      if (!book) router.push(adminBookPath(saved.id));
    },
    onError: (error) => {
      for (const [field] of Object.entries(fieldErrors(error))) {
        const text = fieldErrorText(error, field);
        if (text && field in defaultsOf()) {
          setError(field as keyof BookFormValues, { type: "server", message: text });
        }
      }
    },
  });

  const remove = useMutation({
    mutationFn: () => getAdminApi().deleteBook(book!.id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ADMIN_ROOT_KEY });
      toast({ variant: "success", title: t("deleted") });
      router.push(ADMIN_ROUTES.books);
    },
  });

  const serverText = (field: keyof BookFormValues) => {
    const e = errors[field];
    return e?.type === "server" ? e.message : msg(e?.message);
  };
  const subjectOptions = (subjects ?? []).map((subject) => ({
    value: subject.slug,
    label: getLocalized(subject.title, locale),
  }));
  const gradeOptions = GRADES.map((grade) => ({
    value: String(grade),
    label: t("gradeOption", { grade }),
  }));

  return (
    <form
      onSubmit={handleSubmit((values) => save.mutate(values))}
      noValidate
      className="flex flex-col gap-6"
      aria-label={t(book ? "editTitle" : "createTitle")}
      data-testid="book-form"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label={t("slug")}
          hint={book ? t("slugLocked") : t("slugHint")}
          error={serverText("slug")}
          disabled={Boolean(book)}
          autoComplete="off"
          {...register("slug")}
        />
        <Controller
          control={control}
          name="subject"
          render={({ field }) => (
            <Select
              label={t("subject")}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              ref={field.ref}
              options={subjectOptions}
              placeholder={t("choose")}
              error={serverText("subject")}
            />
          )}
        />
        <Controller
          control={control}
          name="grade"
          render={({ field }) => (
            <Select
              label={t("grade")}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              ref={field.ref}
              options={gradeOptions}
              placeholder={t("choose")}
              searchable={false}
              error={serverText("grade")}
            />
          )}
        />
        <Input
          label={t("year")}
          type="number"
          inputMode="numeric"
          error={serverText("year")}
          {...register("year")}
        />
      </div>

      <Controller
        control={control}
        name="title"
        render={({ field }) => (
          <LocalizedFields
            label={t("title")}
            name="title"
            value={field.value}
            onChange={field.onChange}
            error={msg(errors.title?.uz?.message) ?? fieldErrorText(save.error, "title")}
          />
        )}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Input
          label={t("author")}
          error={serverText("author")}
          autoComplete="off"
          {...register("author")}
        />
        <Input
          label={t("edition")}
          error={serverText("edition")}
          autoComplete="off"
          {...register("edition")}
        />
        <Input label={t("publisher")} autoComplete="off" {...register("publisher")} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Controller
          control={control}
          name="cover"
          render={({ field }) => (
            <FileUpload
              kind="cover"
              label={t("cover")}
              path={field.value}
              url={urls.cover}
              onChange={(path, url) => {
                field.onChange(path);
                setUrls((current) => ({ ...current, cover: url }));
              }}
            />
          )}
        />
        <Controller
          control={control}
          name="pdf"
          render={({ field }) => (
            <FileUpload
              kind="pdf"
              label={t("pdf")}
              path={field.value}
              url={urls.pdf}
              onChange={(path, url) => {
                field.onChange(path);
                setUrls((current) => ({ ...current, pdf: url }));
              }}
            />
          )}
        />
      </div>

      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" className="mt-0.5 size-4" {...register("is_published")} />
        <span>
          <span className="font-medium">{t("isPublished")}</span>
          <span className="text-muted block">{t("isPublishedHint")}</span>
        </span>
      </label>

      {save.isError && !Object.keys(fieldErrors(save.error)).length && (
        <p role="alert" className="text-danger text-sm">
          {errorText(save.error)}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={save.isPending} disabled={Boolean(book) && !isDirty}>
          {t(book ? "save" : "create")}
        </Button>
        {book && canDelete(role) && (
          <Button variant="danger" onClick={() => setConfirmOpen(true)}>
            {tc("delete")}
          </Button>
        )}
      </div>

      {book && (
        <Dialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={t("deleteTitle")}
          description={t("deleteDescription", { title: getLocalized(book.title, locale) })}
        >
          {remove.isError && (
            <p role="alert" className="text-danger mb-3 text-sm">
              {errorText(remove.error)}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button variant="danger" loading={remove.isPending} onClick={() => remove.mutate()}>
              {tc("delete")}
            </Button>
          </div>
        </Dialog>
      )}
    </form>
  );
}
