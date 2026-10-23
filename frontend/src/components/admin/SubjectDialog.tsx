"use client";

import { useMemo, useState } from "react";
import { yupResolver } from "@hookform/resolvers/yup";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { getAdminApi } from "@/lib/admin/api";
import { ADMIN_ROOT_KEY } from "@/lib/admin/queries";
import { GRADE_PRESETS } from "@/lib/admin/grades";
import { slugify } from "@/lib/admin/slug";
import type { AdminSubject } from "@/lib/admin/types";
import { createSubjectSchema } from "@/lib/validation/admin";
import type { LocalizedText } from "@/types/i18n";
import { GradePicker } from "./GradePicker";
import { LocalizedFields, toLocalized } from "./LocalizedFields";
import { useAdminErrorText, useAdminFieldErrorText } from "./useAdminErrorText";

interface SubjectFormValues {
  slug: string;
  title: LocalizedText;
  /** Katalog tabi uchun guruh; `none` — guruhsiz (faqat «Hammasi» da). */
  group: string;
}

const GROUP_NONE = "none";
const GROUPS = ["exact", "natural", "language", "social", "arts"] as const;

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
  const tg = useTranslations("pdfBooks.grade.groups");
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
      group: subject?.group || GROUP_NONE,
      title: {
        uz: subject?.title.uz ?? "",
        ru: subject?.title.ru ?? "",
        en: subject?.title.en ?? "",
      },
    },
  });

  const [grades, setGrades] = useState<number[]>(() => [...(subject?.grades ?? GRADE_PRESETS.all)]);

  const save = useMutation({
    mutationFn: (values: SubjectFormValues) => {
      const api = getAdminApi();
      const title = toLocalized(values.title);
      const group = (values.group === GROUP_NONE ? "" : values.group) as AdminSubject["group"];
      return subject
        ? api.updateSubject(subject.id, { title, group, grades })
        : api.createSubject({ slug: values.slug, title, order: nextOrder, group, grades });
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
      <Controller
        control={control}
        name="group"
        render={({ field }) => (
          <Select
            label={t("group")}
            hint={t("groupHint")}
            value={field.value}
            onChange={field.onChange}
            searchable={false}
            options={[
              { value: GROUP_NONE, label: t("groupNone") },
              ...GROUPS.map((group) => ({ value: group, label: tg(group) })),
            ]}
          />
        )}
      />
      <GradePicker
        value={grades}
        onChange={setGrades}
        disabled={save.isPending}
        error={
          grades.length === 0
            ? t("gradesRequired")
            : (fieldErrorText(save.error, "grades") ?? undefined)
        }
      />
      {save.isError && !slugError && !fieldErrorText(save.error, "grades") && (
        <p role="alert" className="text-danger text-sm">
          {errorText(save.error)}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>
          {tc("cancel")}
        </Button>
        <Button type="submit" loading={save.isPending} disabled={grades.length === 0}>
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
