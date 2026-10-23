"use client";

import { useMemo, useState } from "react";
import { yupResolver } from "@hookform/resolvers/yup";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { PageHeader } from "@/components/layout/PageHeader";
import { BookCover } from "@/components/pdf/BookCover";
import { applyCover, coverImageProblem, type CoverChoice } from "@/lib/admin/cover";
import { resolveFileUrl } from "@/lib/pdf/file-url";
import { getPdfBooksApi } from "@/lib/pdf-books/api";
import { Copy, Eye } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/hooks/useToast";
import { getAdminApi } from "@/lib/admin/api";
import type { PdfFileProblem } from "@/lib/admin/pdf-file";
import { canDelete } from "@/lib/admin/permissions";
import { ADMIN_ROOT_KEY, adminQueries } from "@/lib/admin/queries";
import { ADMIN_ROUTES, adminPdfBookPath, adminPdfBookPreviewPath } from "@/lib/admin/routes";
import type { AdminPdfBook, PdfBookStatus } from "@/lib/admin/types";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { formatBytes } from "@/lib/utils/bytes";
import { createPdfBookSchema } from "@/lib/validation/admin";
import { GRADES } from "@/types/catalog";
import type { LocalizedText } from "@/types/i18n";
import { chapterProblems, fromApi, slidesById } from "@/lib/admin/chapters";
import { useAdminIdentity } from "./AdminRoleProvider";
import { BookDetailsFields, toDetailsPatch, type BookDetailsValue } from "./BookDetailsFields";
import type { SlidesContext } from "./ChapterSlides";
import { ConfirmDialog } from "./ConfirmDialog";
import { CoverPicker } from "./CoverPicker";
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
  language: string;
  allowDownload: boolean;
}

const LANGUAGES = ["uz", "ru", "en"] as const;

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

/** Nusxalash va o'quvchi ko'rinishida oldindan ko'rish. */
function BookTools({ book }: { book: AdminPdfBook }) {
  const t = useTranslations("admin.pdfEdit");
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const errorText = useAdminErrorText();
  const duplicate = useMutation({
    mutationFn: () => getAdminApi().duplicatePdfBook(book.id),
    onSuccess: async (copy) => {
      await queryClient.invalidateQueries({ queryKey: ADMIN_ROOT_KEY });
      toast({ variant: "success", title: t("duplicated") });
      router.push(adminPdfBookPath(copy.id));
    },
    onError: (error) => toast({ variant: "error", title: errorText(error) }),
  });
  return (
    <div className="flex flex-wrap items-center gap-2">
      {book.has_file && (
        <Link
          href={adminPdfBookPreviewPath(book.id)}
          className={buttonVariants({ variant: "secondary" })}
        >
          <Eye className="size-4" aria-hidden />
          {t("preview")}
        </Link>
      )}
      <Button variant="secondary" loading={duplicate.isPending} onClick={() => duplicate.mutate()}>
        <Copy className="size-4" aria-hidden />
        {t("duplicate")}
      </Button>
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
    // PDF 1-beti rejimida yangi fayldan muqova qayta chiziladi; boshqa rejimda muqova o'zgarmaydi.
    mutationFn: () =>
      upload.run(book.id, file!, {
        mode: book.cover_mode === "first_page" ? "first_page" : "auto",
        image: null,
      }),
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

/** Muqova rejimi: avtomatik, PDF 1-beti (saqlangan fayldan) yoki o'z rasmi. */
function CoverSection({ book, subjectTitle }: { book: AdminPdfBook; subjectTitle: string }) {
  const t = useTranslations("admin.cover");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const errorText = useAdminErrorText();
  const initial = useMemo<CoverChoice>(
    () => ({ mode: book.cover_mode ?? "auto", image: null }),
    [book.cover_mode],
  );
  const [choice, setChoice] = useState<CoverChoice>(initial);
  const missingImage = choice.mode === "custom" && !choice.image;
  const invalidImage = choice.image ? coverImageProblem(choice.image) !== null : false;
  const unchanged = choice.mode === initial.mode && choice.mode !== "custom";
  const missingFile = choice.mode === "first_page" && !book.has_file;

  const save = useMutation({
    mutationFn: async () => {
      let pdf: { url: string } | undefined;
      if (choice.mode === "first_page") {
        const { url } = await getPdfBooksApi().fileUrl(book.id);
        pdf = { url: resolveFileUrl(url, window.location.origin) };
      }
      return applyCover(getAdminApi(), book.id, choice, pdf);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ADMIN_ROOT_KEY });
      toast({ variant: "success", title: t("saved") });
    },
  });

  return (
    <section
      className="flex flex-col gap-3"
      aria-labelledby="pdf-cover"
      data-testid="cover-section"
    >
      <h2 id="pdf-cover" className="sr-only">
        {t("label")}
      </h2>
      <div className="flex flex-wrap items-start gap-5">
        <BookCover
          grade={book.grade}
          subject={book.subject}
          subjectTitle={subjectTitle}
          src={book.cover_url}
          className="w-24"
        />
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <CoverPicker
            value={choice}
            onChange={(next) => {
              setChoice(next);
              save.reset();
            }}
            disabled={save.isPending}
            firstPageUnavailable={!book.has_file}
          />
          {missingFile && <p className="text-muted text-sm">{t("needFile")}</p>}
          {save.isError && (
            <p role="alert" className="text-danger text-sm">
              {errorText(save.error)}
            </p>
          )}
          <div>
            <Button
              loading={save.isPending}
              disabled={unchanged || missingImage || invalidImage || missingFile}
              onClick={() => save.mutate()}
            >
              {t("save")}
            </Button>
          </div>
        </div>
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
  const { role } = useAdminIdentity();
  const slides = useMemo<SlidesContext>(
    () => ({
      bookId: book.id,
      byId: slidesById(book.chapters ?? []),
      canDelete: canDelete(role),
    }),
    [book.id, book.chapters, role],
  );

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
        slides={slides}
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
  const tl = useTranslations("pdfBooks.page.passport.languages");
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
      language: book.language ?? "uz",
      allowDownload: book.allow_download ?? true,
    },
  });

  const save = useMutation({
    mutationFn: (values: FormValues) =>
      getAdminApi().updatePdfBook(book.id, {
        title: toLocalized(values.title),
        grade: Number(values.grade),
        subject: values.subject,
        language: values.language as AdminPdfBook["language"],
        allow_download: values.allowDownload,
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
        <div className="grid gap-4 sm:grid-cols-2">
          <Controller
            control={control}
            name="language"
            render={({ field }) => (
              <Select
                label={t("language")}
                value={field.value}
                onChange={field.onChange}
                options={LANGUAGES.map((code) => ({ value: code, label: tl(code) }))}
                searchable={false}
              />
            )}
          />
          <Controller
            control={control}
            name="allowDownload"
            render={({ field }) => (
              <label className="flex items-start gap-3 text-sm sm:pt-7">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4"
                  data-testid="allow-download"
                  checked={field.value}
                  onChange={(event) => field.onChange(event.target.checked)}
                />
                <span className="flex flex-col">
                  <span className="font-medium">{t("allowDownload")}</span>
                  <span className="text-muted">{t("allowDownloadHint")}</span>
                  <span className="text-muted tabular-nums">
                    {t("downloads", { count: book.download_count ?? 0 })}
                  </span>
                </span>
              </label>
            )}
          />
        </div>
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
  const { data: subjects } = useQuery(adminQueries.subjects());
  const subjectTitle =
    (subjects ?? [])
      .filter((s) => s.slug === book?.subject)
      .map((s) => getLocalized(s.title, locale))[0] ??
    book?.subject ??
    "";

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
        <div className="flex min-w-0 flex-col gap-4">
          <Details book={book} />
          <PublishActions book={book} />
          <BookTools book={book} />
        </div>
        <CoverSection key={`cover-${book.updated_at}`} book={book} subjectTitle={subjectTitle} />
        <ReplaceFile key={book.updated_at} book={book} />
        <PdfBookForm key={`form-${book.updated_at}`} book={book} />
        <PdfBookDetailsForm key={`details-${book.updated_at}`} book={book} />
      </div>
    </>
  );
}
