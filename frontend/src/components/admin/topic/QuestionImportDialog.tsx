"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileUp, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/hooks/useToast";
import { ApiError } from "@/lib/api/types";
import { getAdminApi } from "@/lib/admin/api";
import { adminKeys } from "@/lib/admin/queries";
import {
  IMPORT_MAX,
  parseQuestionImport,
  serverRowErrors,
  type ImportRow,
} from "@/lib/admin/question-import";
import { OPTION_LETTERS } from "@/lib/admin/questions";
import { cn } from "@/lib/utils/cn";
import { useAdminErrorText } from "../useAdminErrorText";

/** Fayl matni katta bo'lmasin (200 savol ~ bir necha yuz KB). */
const MAX_FILE_BYTES = 2 * 1024 * 1024;

export interface QuestionImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topicId: string;
}

function PreviewRow({ row, rejected }: { row: ImportRow; rejected: boolean }) {
  const t = useTranslations("admin.questions.import");
  const ok = row.item && !rejected;
  const correct = row.item?.options.findIndex((option) => option.is_correct) ?? -1;
  return (
    <li
      className={cn("flex items-start gap-3 px-3 py-2 text-sm", !ok && "bg-danger-soft/40")}
      data-testid="import-row"
      data-valid={ok ? "true" : "false"}
    >
      {ok ? (
        <CheckCircle2 className="text-success mt-0.5 size-4 shrink-0" aria-label={t("valid")} />
      ) : (
        <XCircle className="text-danger mt-0.5 size-4 shrink-0" aria-label={t("invalid")} />
      )}
      <span className="text-muted w-14 shrink-0 tabular-nums">{t("line", { line: row.line })}</span>
      <span className="min-w-0 flex-1">
        <span className="text-foreground block truncate">{row.preview || "—"}</span>
        {row.item && (
          <span className="text-muted block truncate text-xs">
            {row.item.options
              .map((option, index) => `${OPTION_LETTERS[index]}) ${option.text.uz}`)
              .join("  ")}
          </span>
        )}
        {!ok && (
          <span className="text-danger block text-xs">
            {rejected
              ? t("errors.server")
              : row.errors.map((code) => t(`errors.${code}`)).join(" · ")}
          </span>
        )}
      </span>
      {row.item && correct >= 0 && (
        <Badge variant="success" className="shrink-0">
          {OPTION_LETTERS[correct]}
        </Badge>
      )}
    </li>
  );
}

function ImportBody({ topicId, onDone }: { topicId: string; onDone: () => void }) {
  const t = useTranslations("admin.questions.import");
  const tc = useTranslations("admin.common");
  const queryClient = useQueryClient();
  const errorText = useAdminErrorText();
  const { toast } = useToast();
  const [text, setText] = useState("");
  const [fileError, setFileError] = useState(false);
  const [rejected, setRejected] = useState<Set<number>>(new Set());

  const parsed = useMemo(() => (text.trim() ? parseQuestionImport(text) : null), [text]);
  const validRows = parsed && !parsed.error ? parsed.rows.filter((row) => row.item) : [];
  const invalidCount = parsed && !parsed.error ? parsed.rows.length - validRows.length : 0;

  const submit = useMutation({
    mutationFn: () =>
      getAdminApi().importQuestions(
        topicId,
        validRows.map((row) => row.item!),
      ),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: adminKeys.topicQuestions(topicId) });
      toast({ variant: "success", title: t("done", { n: result.created }) });
      onDone();
    },
    onError: (error) => {
      // Server ham qatorni rad etsa (backend qoidasi o'zgargan) — qaysi qatorligini ko'rsatamiz.
      if (error instanceof ApiError && error.code === "validation_error") {
        setRejected(serverRowErrors(error.details?.questions, validRows));
      }
    },
  });

  const readFile = async (file: File) => {
    setFileError(file.size > MAX_FILE_BYTES);
    if (file.size > MAX_FILE_BYTES) return;
    setRejected(new Set());
    setText(await file.text());
  };

  return (
    <div className="flex flex-col gap-4" data-testid="question-import">
      <div className="text-muted flex flex-col gap-1 text-sm">
        <p>{t("formatCsv")}</p>
        <code className="bg-subtle text-foreground rounded px-2 py-1 text-xs break-all">
          {t("exampleCsv")}
        </code>
        <p>{t("formatJson")}</p>
      </div>

      <label className="border-border hover:bg-subtle flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-3 text-sm font-medium transition-colors">
        <FileUp className="size-4" aria-hidden />
        {t("file")}
        <input
          type="file"
          accept=".csv,.json,.txt,text/csv,application/json"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void readFile(file);
            event.target.value = "";
          }}
        />
      </label>
      {fileError && (
        <p role="alert" className="text-danger text-sm">
          {t("errors.fileTooLarge")}
        </p>
      )}

      <Textarea
        label={t("paste")}
        rows={6}
        value={text}
        spellCheck={false}
        className="font-mono text-xs"
        onChange={(event) => {
          setRejected(new Set());
          setText(event.target.value);
        }}
      />

      {parsed?.error && (
        <p role="alert" className="text-danger text-sm">
          {t(`errors.${parsed.error}`, { max: IMPORT_MAX })}
        </p>
      )}

      {parsed && !parsed.error && (
        <section className="flex flex-col gap-2" aria-label={t("preview")}>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">{t("preview")}</span>
            <Badge variant="success">{t("validCount", { n: validRows.length })}</Badge>
            {invalidCount > 0 && (
              <Badge variant="danger">{t("invalidCount", { n: invalidCount })}</Badge>
            )}
          </div>
          <ol className="border-border divide-border max-h-72 divide-y overflow-y-auto rounded-lg border">
            {parsed.rows.map((row) => (
              <PreviewRow key={row.line} row={row} rejected={rejected.has(row.line)} />
            ))}
          </ol>
          {invalidCount > 0 && validRows.length > 0 && (
            <p className="text-muted text-sm">{t("skipInvalid")}</p>
          )}
        </section>
      )}

      {submit.isError && rejected.size === 0 && (
        <p role="alert" className="text-danger text-sm">
          {errorText(submit.error)}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>
          {tc("cancel")}
        </Button>
        <Button
          loading={submit.isPending}
          disabled={validRows.length === 0}
          onClick={() => submit.mutate()}
          data-testid="question-import-submit"
        >
          {t("submit", { n: validRows.length })}
        </Button>
      </div>
    </div>
  );
}

/** Ommaviy import: CSV (savol, A, B, C, D, to'g'ri_javob) yoki JSON; oldindan ko'rish bilan. */
export function QuestionImportDialog({ open, onOpenChange, topicId }: QuestionImportDialogProps) {
  const t = useTranslations("admin.questions.import");
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t("title")} className="sm:max-w-2xl">
      {open && <ImportBody topicId={topicId} onDone={() => onOpenChange(false)} />}
    </Dialog>
  );
}
