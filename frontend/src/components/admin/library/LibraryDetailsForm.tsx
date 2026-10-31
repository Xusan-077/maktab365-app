"use client";

import { yupResolver } from "@hookform/resolvers/yup";
import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Controller, useFieldArray, useForm, type Resolver } from "react-hook-form";
import { useAdminErrorText } from "@/components/admin/useAdminErrorText";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select, type SelectOption } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { BOOK_LANGUAGES, BOOK_TYPES } from "@/lib/books/filters";
import {
  libraryBookSchema,
  toPayload,
  type LibraryBookValues,
} from "@/lib/validation/library-book";
import { GRADES } from "@/types/catalog";

const CARD = "border-border bg-surface flex flex-col gap-4 rounded-xl border p-4 sm:p-5";

export interface LibraryDetailsFormProps {
  initial: LibraryBookValues;
  submitLabel: string;
  /** Saqlash; xato bo'lsa otadi (forma uni maydonlarga va umumiy xabarga ajratadi). */
  onSubmit: (payload: ReturnType<typeof toPayload>) => Promise<void>;
}

/** Kitob ma'lumotlari va mundarija formasi (RHF + Yup). */
export function LibraryDetailsForm({ initial, submitLabel, onSubmit }: LibraryDetailsFormProps) {
  const t = useTranslations("admin.library");
  const tf = useTranslations("admin.library.form");
  const tc = useTranslations("books");
  const errorText = useAdminErrorText();

  const form = useForm<LibraryBookValues>({
    resolver: yupResolver(libraryBookSchema) as unknown as Resolver<LibraryBookValues>,
    defaultValues: initial,
  });
  const { register, control, handleSubmit, setError, formState } = form;
  const chapters = useFieldArray({ control, name: "chapters" });
  const { errors, isSubmitting } = formState;
  const rootError = errors.root?.message;

  const message = (key: string | undefined) => (key && tf.has(key) ? tf(key) : undefined);

  const typeOptions: SelectOption[] = BOOK_TYPES.map((value) => ({
    value,
    label: tc(`typeName.${value}`),
  }));
  const gradeOptions: SelectOption[] = [
    { value: "", label: tf("noGrade") },
    ...GRADES.map((grade) => ({ value: String(grade), label: tc("gradeLabel", { grade }) })),
  ];
  const languageOptions: SelectOption[] = BOOK_LANGUAGES.map((value) => ({
    value,
    label: tc(`languages.${value}`),
  }));

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(toPayload(values));
    } catch (error) {
      setError("root", { message: errorText(error) });
    }
  });

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      <section aria-labelledby="library-details" className={CARD}>
        <h2 id="library-details" className="font-semibold">
          {tf("details")}
        </h2>
        <Input
          label={tf("titleLabel")}
          maxLength={255}
          autoComplete="off"
          error={message(errors.title?.message)}
          {...register("title")}
        />
        <Input
          label={tf("authorLabel")}
          maxLength={255}
          autoComplete="off"
          error={message(errors.author?.message)}
          {...register("author")}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <Select
                label={tf("typeLabel")}
                searchable={false}
                options={typeOptions}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                ref={field.ref}
              />
            )}
          />
          <Controller
            control={control}
            name="grade"
            render={({ field }) => (
              <Select
                label={tf("gradeLabel")}
                searchable={false}
                options={gradeOptions}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                ref={field.ref}
              />
            )}
          />
          <Controller
            control={control}
            name="language"
            render={({ field }) => (
              <Select
                label={tf("languageLabel")}
                searchable={false}
                options={languageOptions}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                ref={field.ref}
              />
            )}
          />
        </div>
        <Textarea
          label={tf("descriptionLabel")}
          rows={5}
          maxLength={4000}
          error={message(errors.description?.message)}
          {...register("description")}
        />
      </section>

      <section aria-labelledby="library-chapters" className={CARD}>
        <h2 id="library-chapters" className="font-semibold">
          {t("chapters.title")}
        </h2>
        {chapters.fields.length === 0 && (
          <p className="text-muted text-sm">{t("chapters.empty")}</p>
        )}
        <ul className="flex flex-col gap-3">
          {chapters.fields.map((field, index) => (
            <li
              key={field.id}
              className="grid grid-cols-[minmax(0,1fr)_6.5rem_auto] items-start gap-2"
            >
              <Input
                aria-label={t("chapters.titleLabel")}
                placeholder={t("chapters.titleLabel")}
                maxLength={200}
                error={message(errors.chapters?.[index]?.title?.message)}
                {...register(`chapters.${index}.title`)}
              />
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                aria-label={t("chapters.pageLabel")}
                placeholder={t("chapters.pageLabel")}
                error={message(errors.chapters?.[index]?.page?.message)}
                {...register(`chapters.${index}.page`)}
              />
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("chapters.remove")}
                onClick={() => chapters.remove(index)}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
        <Button
          variant="secondary"
          size="sm"
          className="self-start"
          onClick={() => chapters.append({ title: "", page: 1 })}
        >
          <Plus className="size-4" aria-hidden />
          {t("chapters.add")}
        </Button>
      </section>

      {rootError && (
        <p role="alert" className="text-danger text-sm">
          {rootError}
        </p>
      )}
      <div>
        <Button type="submit" loading={isSubmitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
