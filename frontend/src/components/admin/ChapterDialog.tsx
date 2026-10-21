"use client";

import { useMemo } from "react";
import { yupResolver } from "@hookform/resolvers/yup";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { getAdminApi } from "@/lib/admin/api";
import { ADMIN_ROOT_KEY } from "@/lib/admin/queries";
import { slugify } from "@/lib/admin/slug";
import type { AdminChapter } from "@/lib/admin/types";
import { createChapterSchema } from "@/lib/validation/admin";
import type { LocalizedText } from "@/types/i18n";
import { LocalizedFields, toLocalized } from "./LocalizedFields";
import { useAdminErrorText, useAdminFieldErrorText } from "./useAdminErrorText";

interface ChapterFormValues {
  slug: string;
  title: LocalizedText;
}

export interface ChapterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookId: string;
  /** Berilsa — tahrirlash (slug o'zgarmaydi), aks holda yangi bob. */
  chapter?: AdminChapter | { id: string; slug: string; title: LocalizedText };
}

function ChapterFormBody({
  bookId,
  chapter,
  onDone,
}: Omit<ChapterDialogProps, "open" | "onOpenChange"> & { onDone: () => void }) {
  const t = useTranslations("admin.chapter");
  const tv = useTranslations("admin.validation");
  const tc = useTranslations("admin.common");
  const queryClient = useQueryClient();
  const errorText = useAdminErrorText();
  const fieldErrorText = useAdminFieldErrorText();
  const schema = useMemo(() => createChapterSchema(), []);
  const {
    register,
    control,
    handleSubmit,
    setValue,
    getFieldState,
    formState: { errors },
  } = useForm<ChapterFormValues>({
    resolver: yupResolver(schema) as unknown as Resolver<ChapterFormValues>,
    defaultValues: {
      slug: chapter?.slug ?? "",
      title: {
        uz: chapter?.title.uz ?? "",
        ru: chapter?.title.ru ?? "",
        en: chapter?.title.en ?? "",
      },
    },
  });

  const save = useMutation({
    mutationFn: (values: ChapterFormValues) => {
      const api = getAdminApi();
      const title = toLocalized(values.title);
      return chapter
        ? api.updateChapter(chapter.id, { title })
        : api.createChapter({ book: bookId, slug: values.slug, title });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ADMIN_ROOT_KEY });
      onDone();
    },
  });

  const slugError = errors.slug?.message
    ? tv(errors.slug.message)
    : fieldErrorText(save.error, "slug");

  return (
    <form
      onSubmit={handleSubmit((values) => save.mutate(values))}
      noValidate
      className="flex flex-col gap-4"
    >
      <Controller
        control={control}
        name="title"
        render={({ field }) => (
          <LocalizedFields
            label={t("title")}
            name="chapter-title"
            value={field.value}
            onChange={(value) => {
              field.onChange(value);
              // Slug qo'lda tegilmagan bo'lsa, sarlavhadan taklif qilinadi.
              if (!chapter && !getFieldState("slug").isDirty) {
                setValue("slug", slugify(value.uz));
              }
            }}
            error={errors.title?.uz?.message ? tv(errors.title.uz.message) : undefined}
          />
        )}
      />
      <Input
        label={t("slug")}
        hint={chapter ? t("slugLocked") : t("slugHint")}
        error={slugError}
        disabled={Boolean(chapter)}
        autoComplete="off"
        {...register("slug")}
      />
      {save.isError && !slugError && (
        <p role="alert" className="text-danger text-sm">
          {errorText(save.error)}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>
          {tc("cancel")}
        </Button>
        <Button type="submit" loading={save.isPending}>
          {chapter ? tc("save") : tc("create")}
        </Button>
      </div>
    </form>
  );
}

/** Bob qo'shish/nomini o'zgartirish dialogi. */
export function ChapterDialog({ open, onOpenChange, bookId, chapter }: ChapterDialogProps) {
  const t = useTranslations("admin.chapter");
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t(chapter ? "editTitle" : "createTitle")}
    >
      {/* Dialog yopilganda forma holati tozalansin: ochiq bo'lgandagina chiziladi. */}
      {open && (
        <ChapterFormBody bookId={bookId} chapter={chapter} onDone={() => onOpenChange(false)} />
      )}
    </Dialog>
  );
}
