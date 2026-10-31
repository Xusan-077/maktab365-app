"use client";

import { yupResolver } from "@hookform/resolvers/yup";
import { Plus } from "lucide-react";
import { Controller, FormProvider, useFieldArray, useForm, type Resolver } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Button, buttonVariants } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { useSaveQuiz } from "@/hooks/useQuizMutations";
import { useToast } from "@/hooks/useToast";
import { ApiError } from "@/lib/api/types";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { blankQuestion, formValuesToInput } from "@/lib/quizzes/form";
import { QUIZ_LIMITS } from "@/lib/quizzes/types";
import { quizPaths } from "@/lib/utils/routes";
import { quizFormSchema, type QuizFormValues } from "@/lib/validation/quiz";
import { CategoryField } from "./CategoryField";
import { ImageField } from "./ImageField";
import { QuestionEditor } from "./QuestionEditor";
import { QuizSettingsFields } from "./QuizSettingsFields";

interface Props {
  initial: QuizFormValues;
  /** Berilsa — tahrirlash, aks holda yangi test. */
  quizId?: string;
}

/** Test yaratish/tahrirlash formasi (RHF + Yup). */
export function QuizForm({ initial, quizId }: Props) {
  const t = useTranslations("quizzes.form");
  const router = useRouter();
  const { toast } = useToast();
  const save = useSaveQuiz(quizId);

  const form = useForm<QuizFormValues>({
    resolver: yupResolver(quizFormSchema) as unknown as Resolver<QuizFormValues>,
    defaultValues: initial,
  });
  const { control, register, handleSubmit, formState, setValue, getValues } = form;
  const questions = useFieldArray({ control, name: "questions" });

  const errorText = (key: string | undefined) =>
    key
      ? t(`errors.${key}`, {
          min: QUIZ_LIMITS.optionsMin,
          max: QUIZ_LIMITS.questionsMax,
        })
      : undefined;

  const onSubmit = handleSubmit((values) => {
    save.mutate(formValuesToInput(values), {
      onSuccess: () => {
        toast({ variant: "success", title: t(quizId ? "saved" : "created") });
        router.push(quizPaths.list());
      },
      onError: (error) => {
        const code =
          error instanceof ApiError ? error.details && JSON.stringify(error.details) : "";
        toast({
          variant: "error",
          title: t("saveFailed"),
          description: code?.includes("quizzes_limit") ? t("errors.quizzes_limit") : undefined,
        });
      },
    });
  });

  const questionsError =
    formState.errors.questions?.root?.message ?? formState.errors.questions?.message;

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6" data-testid="quiz-form">
        <Card className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">{t("basics.title")}</h2>
          <Input
            label={t("basics.name")}
            placeholder={t("basics.namePlaceholder")}
            maxLength={QUIZ_LIMITS.title}
            error={errorText(formState.errors.title?.message)}
            {...register("title")}
          />
          <Textarea
            label={t("basics.description")}
            placeholder={t("basics.descriptionPlaceholder")}
            maxLength={QUIZ_LIMITS.description}
            error={errorText(formState.errors.description?.message)}
            {...register("description")}
          />
          <Controller
            control={control}
            name="categoryId"
            render={({ field }) => <CategoryField value={field.value} onChange={field.onChange} />}
          />
          <Controller
            control={control}
            name="coverImage"
            render={({ field }) => (
              <ImageField
                label={t("basics.cover")}
                value={{ path: field.value, url: getValues("coverUrl") ?? null }}
                onChange={(image) => {
                  field.onChange(image.path);
                  setValue("coverUrl", image.url, { shouldDirty: true });
                }}
              />
            )}
          />
        </Card>

        <QuizSettingsFields />

        <section className="flex flex-col gap-4" aria-labelledby="questions-heading">
          <h2 id="questions-heading" className="text-lg font-semibold">
            {t("questions.title", { count: questions.fields.length })}
          </h2>
          {questions.fields.map((field, index) => (
            <QuestionEditor
              key={field.id}
              index={index}
              total={questions.fields.length}
              onMove={questions.move}
              onRemove={questions.remove}
            />
          ))}
          {typeof questionsError === "string" && (
            <p role="alert" className="text-danger text-sm">
              {errorText(questionsError)}
            </p>
          )}
          <Button
            variant="secondary"
            className="self-start"
            disabled={questions.fields.length >= QUIZ_LIMITS.questionsMax}
            onClick={() => questions.append(blankQuestion())}
          >
            <Plus className="size-4" aria-hidden />
            {t("questions.add")}
          </Button>
        </section>

        <div className="bg-background/90 border-border sticky bottom-0 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
          <p className="text-muted text-sm" role="status">
            {formState.isSubmitted && !formState.isValid ? t("fixErrors") : null}
          </p>
          <div className="flex gap-2">
            <Link href={quizPaths.list()} className={buttonVariants({ variant: "ghost" })}>
              {t("cancel")}
            </Link>
            <Button type="submit" loading={save.isPending}>
              {t(quizId ? "saveChanges" : "create")}
            </Button>
          </div>
        </div>
      </form>
    </FormProvider>
  );
}
