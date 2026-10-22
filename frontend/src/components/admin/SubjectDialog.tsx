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
import type { AdminSubject } from "@/lib/admin/types";
import { createSubjectSchema } from "@/lib/validation/admin";
import type { LocalizedText } from "@/types/i18n";
import { LocalizedFields, toLocalized } from "./LocalizedFields";
import { useAdminErrorText, useAdminFieldErrorText } from "./useAdminErrorText";

interface SubjectFormValues {
  slug: string;
  title: LocalizedText;
}

export interface SubjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Berilsa — nomini tahrirlash (slug o'zgarmaydi), aks holda yangi fan. */
  subject?: AdminSubject;
  /** Yangi fan ro'yxat oxiriga qo'yiladigan tartib raqami. */
  nextOrder: number;
}

function SubjectFormBody({
  subject,
  nextOrder,
  onDone,
}: Omit<SubjectDialogProps, "open" | "onOpenChange"> & { onDone: () => void }) {
  const t = useTranslations("admin.subjects");
  const tv = useTranslations("admin.validation");
  const tc = useTranslations("admin.common");
  const queryClient = useQueryClient();
  const errorText = useAdminErrorText();
  const fieldErrorText = useAdminFieldErrorText();
  const schema = useMemo(() => createSubjectSchema(), []);
  const {
    register,
    control,
    handleSubmit,
    setValue,
    getFieldState,
    formState: { errors },
  } = useForm<SubjectFormValues>({
    resolver: yupResolver(schema) as unknown as Resolver<SubjectFormValues>,
    defaultValues: {
      slug: subject?.slug ?? "",
      title: {
        uz: subject?.title.uz ?? "",
        ru: subject?.title.ru ?? "",
        en: subject?.title.en ?? "",
      },
    },
  });

  const save = useMutation({
    mutationFn: (values: SubjectFormValues) => {
      const api = getAdminApi();
      const title = toLocalized(values.title);
      return subject
        ? api.updateSubject(subject.id, { title })
        : api.createSubject({ slug: values.slug, title, order: nextOrder });
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
      data-testid="subject-form"
    >
      <Controller
        control={control}
        name="title"
        render={({ field }) => (
          <LocalizedFields
            label={t("name")}
            name="subject-title"
            value={field.value}
            onChange={(value) => {
              field.onChange(value);
              // Slug qo'lda tegilmagan bo'lsa, nomdan taklif qilinadi.
              if (!subject && !getFieldState("slug").isDirty) {
                setValue("slug", slugify(value.uz));
              }
            }}
            error={errors.title?.uz?.message ? tv(errors.title.uz.message) : undefined}
          />
        )}
      />
      <Input
        label={t("slug")}
        hint={subject ? t("slugLocked") : t("slugHint")}
        error={slugError}
        disabled={Boolean(subject)}
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
          {subject ? tc("save") : tc("create")}
        </Button>
      </div>
    </form>
  );
}

/** Fan qo'shish / nomini o'zgartirish dialogi. */
export function SubjectDialog({ open, onOpenChange, subject, nextOrder }: SubjectDialogProps) {
  const t = useTranslations("admin.subjects");
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t(subject ? "editTitle" : "createTitle")}
    >
      {/* Dialog yopilganda forma holati tozalansin: ochiq bo'lgandagina chiziladi. */}
      {open && (
        <SubjectFormBody
          subject={subject}
          nextOrder={nextOrder}
          onDone={() => onOpenChange(false)}
        />
      )}
    </Dialog>
  );
}
