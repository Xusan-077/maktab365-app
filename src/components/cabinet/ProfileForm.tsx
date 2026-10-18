"use client";

import { yupResolver } from "@hookform/resolvers/yup";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { GraduationCap, UserRound } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useSubjects } from "@/hooks/useSubjects";
import { useToast } from "@/hooks/useToast";
import { getApi } from "@/lib/api";
import { queryKeys } from "@/lib/api/query-keys";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { cn } from "@/lib/utils/cn";
import { profileSchema, toProfileInput, type ProfileFormValues } from "@/lib/validation/profile";
import { GRADES } from "@/types/catalog";
import type { User } from "@/types/user";

export interface ProfileFormProps {
  /** Mavjud profil (sozlamalar) yoki `null` (onboarding). */
  initial?: User | null;
  /** Profil yo'q bo'lsa ism uchun boshlang'ich qiymat (Google ismi). */
  defaultName?: string;
  submitLabel: string;
  /** Muvaffaqiyatli saqlangandan keyin. */
  onSaved?: (user: User) => void;
}

const pillClasses =
  "border-border bg-surface hover:bg-subtle has-[:checked]:border-primary-600 has-[:checked]:bg-primary-600 has-[:checked]:text-white has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--ring)] inline-flex h-9 cursor-pointer items-center rounded-full border px-4 text-sm font-medium transition-colors select-none";

const cardClasses =
  "border-border bg-surface hover:bg-subtle has-[:checked]:border-primary-600 has-[:checked]:bg-primary-soft has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--ring)] flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors";

function defaultsFor(initial: User | null | undefined, defaultName: string): ProfileFormValues {
  if (initial?.role === "teacher") {
    return {
      role: "teacher",
      name: initial.name,
      subjects: initial.subjects ?? [],
      // RHF checkbox guruhi qiymatlarni qat'iy tenglik bilan solishtiradi: satr bo'lishi kerak
      grades: (initial.grades ?? []).map(String),
    };
  }
  return {
    role: "student",
    name: initial?.name ?? defaultName,
    grade: initial?.role === "student" ? initial.grade : undefined,
    subjects: [],
    grades: [],
  };
}

/** Onboarding va sozlamalar uchun umumiy forma: rol (o'quvchi/o'qituvchi) va unga mos maydonlar. */
export function ProfileForm({ initial, defaultName = "", submitLabel, onSaved }: ProfileFormProps) {
  const t = useTranslations("onboarding");
  const locale = useLocale() as Locale;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: subjects } = useSubjects();

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: yupResolver(profileSchema) as unknown as Resolver<ProfileFormValues>,
    defaultValues: defaultsFor(initial, defaultName),
  });
  const role = useWatch({ control, name: "role" });

  const save = useMutation({
    mutationFn: (values: ProfileFormValues) => getApi().saveProfile(toProfileInput(values)),
    onSuccess: (user) => {
      queryClient.setQueryData(queryKeys.me(), user);
      onSaved?.(user);
    },
    onError: () => toast({ variant: "error", title: t("saveFailed") }),
  });

  const fieldError = (message?: string) =>
    message ? t(`errors.${message}` as "errors.nameRequired") : undefined;

  return (
    <form
      noValidate
      onSubmit={handleSubmit((values) => save.mutate(values))}
      className="flex flex-col gap-6"
    >
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-base font-semibold">{t("roleLegend")}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={cardClasses}>
            <input type="radio" value="student" className="sr-only" {...register("role")} />
            <UserRound className="text-primary-600 mt-0.5 size-5 shrink-0" aria-hidden />
            <span>
              <span className="block font-semibold">{t("roleStudent")}</span>
              <span className="text-muted block text-sm">{t("roleStudentHint")}</span>
            </span>
          </label>
          <label className={cardClasses}>
            <input type="radio" value="teacher" className="sr-only" {...register("role")} />
            <GraduationCap className="text-primary-600 mt-0.5 size-5 shrink-0" aria-hidden />
            <span>
              <span className="block font-semibold">{t("roleTeacher")}</span>
              <span className="text-muted block text-sm">{t("roleTeacherHint")}</span>
            </span>
          </label>
        </div>
      </fieldset>

      <Input
        label={t("nameLabel")}
        autoComplete="name"
        error={fieldError(errors.name?.message)}
        {...register("name")}
      />

      {role === "student" ? (
        <Select
          label={t("gradeLabel")}
          error={fieldError(errors.grade?.message)}
          {...register("grade")}
        >
          <option value="">{t("gradePlaceholder")}</option>
          {GRADES.map((grade) => (
            <option key={grade} value={grade}>
              {t("gradeOption", { grade })}
            </option>
          ))}
        </Select>
      ) : (
        <>
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 text-sm font-medium">{t("subjectsLabel")}</legend>
            <div className="flex flex-wrap gap-2">
              {subjects?.map((subject) => (
                <label key={subject.id} className={pillClasses}>
                  <input
                    type="checkbox"
                    value={subject.id}
                    className="sr-only"
                    {...register("subjects")}
                  />
                  {getLocalized(subject.name, locale)}
                </label>
              ))}
            </div>
            {errors.subjects?.message && (
              <p role="alert" className="text-danger text-sm">
                {fieldError(errors.subjects.message)}
              </p>
            )}
          </fieldset>
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 text-sm font-medium">{t("gradesLabel")}</legend>
            <div className="flex flex-wrap gap-2">
              {GRADES.map((grade) => (
                <label key={grade} className={cn(pillClasses, "px-3")}>
                  <input
                    type="checkbox"
                    value={grade}
                    className="sr-only"
                    {...register("grades")}
                  />
                  {t("gradeOption", { grade })}
                </label>
              ))}
            </div>
            {errors.grades?.message && (
              <p role="alert" className="text-danger text-sm">
                {fieldError(errors.grades.message)}
              </p>
            )}
          </fieldset>
        </>
      )}

      <div>
        <Button type="submit" size="lg" loading={save.isPending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
