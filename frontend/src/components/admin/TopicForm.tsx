"use client";

import { useMemo } from "react";
import { yupResolver } from "@hookform/resolvers/yup";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/Button";
import { controlClasses, Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/hooks/useToast";
import { getAdminApi } from "@/lib/admin/api";
import { fieldErrorCode } from "@/lib/admin/errors";
import { ADMIN_ROOT_KEY, adminQueries } from "@/lib/admin/queries";
import { adminBookPath, adminTopicPath } from "@/lib/admin/routes";
import { slugify } from "@/lib/admin/slug";
import { STARTER_BLOCKS } from "@/lib/admin/starter-blocks";
import type { AdminTopic } from "@/lib/admin/types";
import { ApiError } from "@/lib/api/types";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { createTopicSchema } from "@/lib/validation/admin";
import type { LocalizedText } from "@/types/i18n";
import { LocalizedFields, toLocalized } from "./LocalizedFields";
import { QueryError } from "./QueryError";
import { TopicStatusBadge } from "./StatusBadge";
import { TransitionButtons } from "./TransitionButtons";
import { useAdminErrorText, useAdminFieldErrorText } from "./useAdminErrorText";

interface TopicFormValues {
  slug: string;
  title: LocalizedText;
  summary: string;
  notes: string;
  blocks: string;
}

function defaultsOf(topic?: AdminTopic): TopicFormValues {
  return {
    slug: topic?.slug ?? "",
    title: { uz: topic?.title.uz ?? "", ru: topic?.title.ru ?? "", en: topic?.title.en ?? "" },
    summary: topic?.summary?.uz ?? "",
    notes: topic?.notes ?? "",
    blocks: JSON.stringify(topic?.blocks ?? STARTER_BLOCKS, null, 2),
  };
}

/** Backend `blocks` xatosi: maydon/blok yo'li bilan kelgan matn (`blocks[3].hint: …`) o'zgarishsiz ko'rsatiladi. */
function blocksServerMessage(error: unknown): string | undefined {
  return fieldErrorCode(error, "blocks");
}

interface TopicFormProps {
  /** Tahrirlashda — mavjud mavzu; yaratishda — bob va kitob id'lari. */
  topic?: AdminTopic;
  bookId: string;
  chapterId: string;
}

function TopicFormBody({ topic, bookId, chapterId }: TopicFormProps) {
  const t = useTranslations("admin.topic");
  const tv = useTranslations("admin.validation");
  const tc = useTranslations("admin.common");
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const errorText = useAdminErrorText();
  const fieldErrorText = useAdminFieldErrorText();
  const schema = useMemo(() => createTopicSchema(), []);
  const {
    register,
    control,
    handleSubmit,
    setValue,
    getFieldState,
    formState: { errors, isDirty },
  } = useForm<TopicFormValues>({
    resolver: yupResolver(schema) as unknown as Resolver<TopicFormValues>,
    defaultValues: defaultsOf(topic),
  });

  const save = useMutation({
    mutationFn: (values: TopicFormValues) => {
      const api = getAdminApi();
      const body = {
        title: toLocalized(values.title),
        summary: { uz: values.summary.trim() },
        notes: values.notes,
        blocks: JSON.parse(values.blocks || "[]") as Record<string, unknown>[],
      };
      return topic
        ? api.updateTopic(topic.id, body)
        : api.createTopic({ ...body, slug: values.slug, chapter: chapterId });
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ADMIN_ROOT_KEY });
      toast({ variant: "success", title: t(topic ? "saved" : "created") });
      if (!topic) router.replace(adminTopicPath(saved.id));
    },
  });

  const slugError = errors.slug?.message
    ? tv(errors.slug.message)
    : fieldErrorText(save.error, "slug");
  const blocksError = errors.blocks?.message
    ? tv(errors.blocks.message)
    : blocksServerMessage(save.error);
  const otherError =
    save.isError && !(save.error instanceof ApiError && save.error.code === "validation_error");

  return (
    <form
      onSubmit={handleSubmit((values) => save.mutate(values))}
      noValidate
      className="flex flex-col gap-6"
      aria-label={t(topic ? "editTitle" : "createTitle")}
      data-testid="topic-form"
    >
      <Controller
        control={control}
        name="title"
        render={({ field }) => (
          <LocalizedFields
            label={t("title")}
            name="topic-title"
            value={field.value}
            onChange={(value) => {
              field.onChange(value);
              if (!topic && !getFieldState("slug").isDirty) setValue("slug", slugify(value.uz));
            }}
            error={
              errors.title?.uz?.message
                ? tv(errors.title.uz.message)
                : fieldErrorText(save.error, "title")
            }
          />
        )}
      />
      <Input
        label={t("slug")}
        hint={topic ? t("slugLocked") : t("slugHint")}
        error={slugError}
        disabled={Boolean(topic)}
        autoComplete="off"
        {...register("slug")}
      />
      <Field id="topic-summary" label={t("summary")} hint={t("summaryHint")}>
        <input
          id="topic-summary"
          className={controlClasses}
          autoComplete="off"
          {...register("summary")}
        />
      </Field>
      <Field id="topic-notes" label={t("notes")} hint={t("notesHint")}>
        <textarea
          id="topic-notes"
          rows={3}
          className={`${controlClasses} h-auto py-2`}
          {...register("notes")}
        />
      </Field>
      <Field id="topic-blocks" label={t("blocks")} hint={t("blocksHint")} error={blocksError}>
        <textarea
          id="topic-blocks"
          rows={14}
          spellCheck={false}
          aria-invalid={blocksError ? true : undefined}
          className={`${controlClasses} h-auto py-2 font-mono text-xs`}
          {...register("blocks")}
        />
      </Field>

      {otherError && (
        <p role="alert" className="text-danger text-sm">
          {errorText(save.error)}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" loading={save.isPending} disabled={Boolean(topic) && !isDirty}>
          {topic ? tc("save") : tc("create")}
        </Button>
        <Link
          href={adminBookPath(bookId)}
          className="text-link text-sm font-medium underline-offset-4 hover:underline"
        >
          {t("backToBook")}
        </Link>
      </div>
    </form>
  );
}

function Header({ topic, bookId }: { topic?: AdminTopic; bookId: string }) {
  const t = useTranslations("admin.topic");
  const format = useFormatter();
  const { data: book } = useQuery(adminQueries.book(bookId));
  const bookTitle = book?.title.uz ?? "";

  return (
    <>
      <PageHeader
        title={topic ? topic.title.uz : t("createTitle")}
        description={bookTitle ? t("inBook", { book: bookTitle }) : undefined}
        action={topic && <TopicStatusBadge status={topic.status} />}
      />
      {topic && (
        <div className="flex flex-col gap-2">
          <TransitionButtons topicId={topic.id} status={topic.status} size="md" />
          <p className="text-muted text-sm">
            {topic.reviewed_by_email && t("reviewedBy", { email: topic.reviewed_by_email })}
            {topic.published_at &&
              ` · ${t("publishedAt", {
                date: format.dateTime(new Date(topic.published_at), { dateStyle: "medium" }),
              })}`}
          </p>
        </div>
      )}
    </>
  );
}

/** Mavzu tahrirlash sahifasi. */
export function TopicEditView({ id }: { id: string }) {
  const { data, error, isPending, refetch } = useQuery(adminQueries.topic(id));
  if (error) return <QueryError error={error} onRetry={() => void refetch()} />;
  if (isPending) return <Skeleton className="h-96" />;
  return (
    <>
      <Header topic={data} bookId={data.book} />
      {/* `key`: nashr holati o'zgarsa ham forma kiritilgan matnni saqlab qoladi, faqat server qiymati almashganda qayta quriladi. */}
      <TopicFormBody
        key={data.updated_at}
        topic={data}
        bookId={data.book}
        chapterId={data.chapter}
      />
    </>
  );
}

/** Yangi mavzu sahifasi (`?book=&chapter=`). */
export function TopicCreateView({ bookId, chapterId }: { bookId: string; chapterId: string }) {
  return (
    <>
      <Header bookId={bookId} />
      <TopicFormBody bookId={bookId} chapterId={chapterId} />
    </>
  );
}
