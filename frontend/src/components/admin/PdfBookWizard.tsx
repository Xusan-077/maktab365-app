"use client";

import { useMemo, useState } from "react";
import { yupResolver } from "@hookform/resolvers/yup";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Controller, useForm, useWatch, type Resolver } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/hooks/useToast";
import { getAdminApi } from "@/lib/admin/api";
import type { PdfFileProblem } from "@/lib/admin/pdf-file";
import { ADMIN_ROOT_KEY, adminQueries } from "@/lib/admin/queries";
import { adminPdfBookPath } from "@/lib/admin/routes";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { useRouter } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils/cn";
import { createPdfBookSchema } from "@/lib/validation/admin";
import { GRADES } from "@/types/catalog";
import type { LocalizedText } from "@/types/i18n";
import { LocalizedFields, toLocalized } from "./LocalizedFields";
import { PdfFilePicker } from "./PdfFilePicker";
import { useAdminErrorText } from "./useAdminErrorText";
import { usePdfUpload } from "./usePdfUpload";

interface WizardValues {
  grade: string;
  subject: string;
  title: LocalizedText;
}

const STEPS = ["grade", "subject", "file"] as const;
type Step = (typeof STEPS)[number];

function Stepper({ current }: { current: Step }) {
  const t = useTranslations("admin.pdfWizard");
  const index = STEPS.indexOf(current);
  return (
    <ol className="flex flex-wrap gap-2" aria-label={t("steps.label")}>
      {STEPS.map((step, i) => (
        <li
          key={step}
          aria-current={step === current ? "step" : undefined}
          className={cn(
            "flex items-center gap-2 rounded-full px-3 py-1 text-sm",
            step === current
              ? "bg-primary-soft text-primary-soft-foreground font-medium"
              : "text-muted",
          )}
        >
          <span className="flex size-5 items-center justify-center rounded-full border text-xs">
            {i < index ? <Check className="size-3" aria-hidden /> : i + 1}
          </span>
          {t(`steps.${step}`)}
        </li>
      ))}
    </ol>
  );
}

/** Tanlash tugmalari katakchasi (sinf / fan). */
function ChoiceGrid({
  label,
  options,
  value,
  onSelect,
  testId,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onSelect: (value: string) => void;
  testId: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          data-testid={`${testId}-${option.value}`}
          onClick={() => onSelect(option.value)}
          className={cn(
            "border-border bg-surface hover:border-primary-300 min-h-12 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
            value === option.value &&
              "border-primary-600 bg-primary-soft text-primary-soft-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Yangi PDF kitob: sinf → fan → nom va PDF fayl (ketma-ket qadamlar). */
export function PdfBookWizard() {
  const t = useTranslations("admin.pdfWizard");
  const tv = useTranslations("admin.validation");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const errorText = useAdminErrorText();
  const { data: subjects } = useQuery(adminQueries.subjects());
  const upload = usePdfUpload();
  const [step, setStep] = useState<Step>("grade");
  const [file, setFile] = useState<File | null>(null);
  const [problem, setProblem] = useState<PdfFileProblem | null>(null);
  const [fileMissing, setFileMissing] = useState(false);
  // Yuklash yiqilsa yozuv qoladi: qayta urinish shu yozuvga yuklaydi (dublikat yaratmaydi).
  const [createdId, setCreatedId] = useState<string | null>(null);

  const schema = useMemo(() => createPdfBookSchema(), []);
  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<WizardValues>({
    resolver: yupResolver(schema) as unknown as Resolver<WizardValues>,
    defaultValues: { grade: "", subject: "", title: { uz: "", ru: "", en: "" } },
  });
  const grade = useWatch({ control, name: "grade" });
  const subject = useWatch({ control, name: "subject" });

  const submit = useMutation({
    mutationFn: async (values: WizardValues) => {
      if (!file) throw new Error("no file");
      const api = getAdminApi();
      const body = {
        title: toLocalized(values.title),
        grade: Number(values.grade),
        subject: values.subject,
      };
      let id = createdId;
      if (id) {
        await api.updatePdfBook(id, body);
      } else {
        id = (await api.createPdfBook(body)).id;
        setCreatedId(id);
      }
      return upload.run(id, file);
    },
    onSuccess: async ({ book, coverFailed }) => {
      await queryClient.invalidateQueries({ queryKey: ADMIN_ROOT_KEY });
      toast({ variant: "success", title: t("created") });
      if (coverFailed) toast({ variant: "info", title: t("coverFailed") });
      router.push(adminPdfBookPath(book.id));
    },
  });

  const busy = submit.isPending;
  const gradeOptions = GRADES.map((g) => ({
    value: String(g),
    label: t("gradeOption", { grade: g }),
  }));
  const subjectOptions = (subjects ?? []).map((s) => ({
    value: s.slug,
    label: getLocalized(s.title, locale),
  }));

  return (
    <form
      noValidate
      className="flex flex-col gap-6"
      aria-label={t("createTitle")}
      data-testid="pdf-wizard"
      onSubmit={handleSubmit((values) => {
        if (!file || problem) {
          setFileMissing(!file);
          return;
        }
        submit.mutate(values);
      })}
    >
      <Stepper current={step} />

      {step === "grade" && (
        <section className="flex flex-col gap-4" aria-labelledby="pdf-step-grade">
          <h2 id="pdf-step-grade" className="text-lg font-semibold">
            {t("gradeHeading")}
          </h2>
          <ChoiceGrid
            label={t("gradeHeading")}
            options={gradeOptions}
            value={grade}
            testId="pdf-grade"
            onSelect={(value) => setValue("grade", value, { shouldValidate: true })}
          />
          {errors.grade && (
            <p role="alert" className="text-danger text-sm">
              {tv(errors.grade.message ?? "required")}
            </p>
          )}
          <div>
            <Button disabled={!grade} onClick={() => setStep("subject")}>
              {t("next")}
            </Button>
          </div>
        </section>
      )}

      {step === "subject" && (
        <section className="flex flex-col gap-4" aria-labelledby="pdf-step-subject">
          <h2 id="pdf-step-subject" className="text-lg font-semibold">
            {t("subjectHeading", { grade })}
          </h2>
          <ChoiceGrid
            label={t("subjectHeading", { grade })}
            options={subjectOptions}
            value={subject}
            testId="pdf-subject"
            onSelect={(value) => setValue("subject", value, { shouldValidate: true })}
          />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep("grade")}>
              {t("back")}
            </Button>
            <Button disabled={!subject} onClick={() => setStep("file")}>
              {t("next")}
            </Button>
          </div>
        </section>
      )}

      {step === "file" && (
        <section className="flex flex-col gap-5" aria-labelledby="pdf-step-file">
          <h2 id="pdf-step-file" className="text-lg font-semibold">
            {t("fileHeading", { grade })}
          </h2>
          <Controller
            control={control}
            name="title"
            render={({ field }) => (
              <LocalizedFields
                label={t("titleLabel")}
                name="pdf-title"
                value={field.value}
                onChange={field.onChange}
                disabled={busy}
                error={errors.title?.uz?.message ? tv(errors.title.uz.message) : undefined}
              />
            )}
          />
          <PdfFilePicker
            label={t("pdfLabel")}
            file={file}
            problem={problem ?? (fileMissing ? "missing" : null)}
            upload={upload.state}
            disabled={busy}
            onChange={(chosen, found) => {
              setFile(chosen);
              setProblem(found);
              setFileMissing(false);
            }}
          />

          {submit.isError && (
            <p role="alert" className="text-danger text-sm">
              {errorText(submit.error)}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={busy} onClick={() => setStep("subject")}>
              {t("back")}
            </Button>
            <Button type="submit" loading={busy}>
              {submit.isError ? t("retry") : t("start")}
            </Button>
          </div>
        </section>
      )}
    </form>
  );
}
