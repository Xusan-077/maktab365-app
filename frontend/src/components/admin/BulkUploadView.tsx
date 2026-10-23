"use client";

import { useCallback, useMemo, useRef, useState, type DragEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, FileUp, Trash2, TriangleAlert } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button, buttonVariants } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Select } from "@/components/ui/Select";
import { getAdminApi } from "@/lib/admin/api";
import { dedupeFiles, makeRow, rowProblem, type BulkRow } from "@/lib/admin/bulk";
import { uploadPdf, xhrSender } from "@/lib/admin/pdf-upload";
import { ADMIN_ROOT_KEY, adminQueries } from "@/lib/admin/queries";
import { ADMIN_ROUTES } from "@/lib/admin/routes";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { Link } from "@/lib/i18n/navigation";
import { formatBytes } from "@/lib/utils/bytes";
import { cn } from "@/lib/utils/cn";
import { GRADES } from "@/types/catalog";
import { useAdminErrorText } from "./useAdminErrorText";

type Run =
  | { state: "idle" }
  | { state: "running"; progress: number }
  | { state: "done"; bookId: string }
  | { state: "error"; error: unknown; bookId?: string };

/**
 * Ommaviy yuklash: bir nechta PDF tashlanadi, fayl nomidan sinf/fan/sarlavha taxmin qilinadi, admin
 * jadvalda tekshiradi va tuzatadi, so'ng hammasi ketma-ket yaratiladi (qoralama sifatida). Yiqilgan
 * qatorni qayta urinish faqat bajarilmagan qismni takrorlaydi (yozuv ikki marta yaratilmaydi).
 */
export function BulkUploadView() {
  const t = useTranslations("admin.bulk");
  const tw = useTranslations("admin.pdfWizard");
  const tp = useTranslations("admin.pdfUpload");
  const locale = useLocale() as Locale;
  const queryClient = useQueryClient();
  const errorText = useAdminErrorText();
  const { data: subjects = [] } = useQuery(adminQueries.subjects());
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [runs, setRuns] = useState<Record<string, Run>>({});
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);
  const subjectRef = useRef(subjects);
  subjectRef.current = subjects;

  const addFiles = useCallback((files: File[]) => {
    setRows((current) => [
      ...current,
      ...dedupeFiles(current, files).map((file) => makeRow(file, subjectRef.current)),
    ]);
  }, []);

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    addFiles(Array.from(event.dataTransfer.files));
  };

  const update = (key: string, patch: Partial<BulkRow>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  const setRun = (key: string, run: Run) => setRuns((current) => ({ ...current, [key]: run }));

  const problems = useMemo(() => new Map(rows.map((row) => [row.key, rowProblem(row)])), [rows]);
  const pending = rows.filter((row) => runs[row.key]?.state !== "done");
  const ready = pending.length > 0 && pending.every((row) => problems.get(row.key) === null);
  const doneCount = rows.length - pending.length;

  const createAll = async () => {
    const api = getAdminApi();
    abort.current = new AbortController();
    setBusy(true);
    for (const row of pending) {
      if (abort.current.signal.aborted) break;
      const previous = runs[row.key];
      let bookId = previous?.state === "error" ? previous.bookId : undefined;
      setRun(row.key, { state: "running", progress: 0 });
      try {
        bookId ??= (
          await api.createPdfBook({
            title: { uz: row.title.trim() },
            grade: row.grade ?? 1,
            subject: row.subject ?? "",
          })
        ).id;
        await uploadPdf({
          api,
          send: xhrSender,
          bookId,
          file: row.file,
          signal: abort.current.signal,
          onProgress: (progress) => setRun(row.key, { state: "running", progress }),
        });
        setRun(row.key, { state: "done", bookId });
      } catch (error) {
        setRun(row.key, { state: "error", error, bookId });
      }
    }
    setBusy(false);
    await queryClient.invalidateQueries({ queryKey: ADMIN_ROOT_KEY });
  };

  const gradeOptions = GRADES.map((g) => ({
    value: String(g),
    label: tw("gradeOption", { grade: g }),
  }));
  const subjectOptions = subjects.map((s) => ({
    value: s.slug,
    label: getLocalized(s.title, locale),
  }));

  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <Link
        href={ADMIN_ROUTES.pdfBooks}
        className="text-link -mt-4 text-sm font-medium underline-offset-4 hover:underline"
      >
        {t("back")}
      </Link>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        data-testid="bulk-dropzone"
        className={cn(
          "border-border bg-surface flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors",
          dragging && "border-primary-600 bg-primary-soft",
        )}
      >
        <FileUp className="text-muted size-8" aria-hidden />
        <p className="text-muted text-sm">{t("drop")}</p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="application/pdf,.pdf"
          className="sr-only"
          data-testid="bulk-input"
          aria-label={t("choose")}
          onChange={(event) => {
            addFiles(Array.from(event.target.files ?? []));
            event.target.value = "";
          }}
        />
        <Button variant="secondary" disabled={busy} onClick={() => inputRef.current?.click()}>
          {t("choose")}
        </Button>
      </div>

      {rows.length > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="bulk-table">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="bulk-table" className="text-lg font-semibold">
              {t("review", { count: rows.length })}
            </h2>
            <p className="text-muted text-sm" aria-live="polite" data-testid="bulk-summary">
              {t("summary", { done: doneCount, total: rows.length })}
            </p>
          </div>
          <ul className="flex flex-col gap-3" data-testid="bulk-rows">
            {rows.map((row) => {
              const run = runs[row.key] ?? { state: "idle" as const };
              const problem = problems.get(row.key);
              const locked = busy || run.state === "done";
              return (
                <li
                  key={row.key}
                  data-testid="bulk-row"
                  className="border-border bg-surface flex flex-col gap-3 rounded-xl border p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-sm font-medium">
                      {row.file.name}{" "}
                      <span className="text-muted font-normal">· {formatBytes(row.file.size)}</span>
                    </p>
                    <div className="flex items-center gap-2">
                      {run.state === "done" ? (
                        <Badge variant="success" className="gap-1">
                          <CheckCircle2 className="size-3.5" aria-hidden />
                          {t("created")}
                        </Badge>
                      ) : problem ? (
                        <Badge variant="accent" className="gap-1" data-testid="bulk-problem">
                          <TriangleAlert className="size-3.5" aria-hidden />
                          {problem === "title" || problem === "grade" || problem === "subject"
                            ? t(`problems.${problem}`)
                            : tp(`problems.${problem}`)}
                        </Badge>
                      ) : (
                        <Badge variant="primary">{t("ready")}</Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={busy}
                        aria-label={t("remove", { name: row.file.name })}
                        onClick={() =>
                          setRows((current) => current.filter((r) => r.key !== row.key))
                        }
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.3fr)]">
                    <Input
                      label={t("titleLabel")}
                      value={row.title}
                      disabled={locked}
                      onChange={(event) => update(row.key, { title: event.target.value })}
                    />
                    <Select
                      label={tw("gradeLabel")}
                      value={row.grade === null ? "" : String(row.grade)}
                      disabled={locked}
                      searchable={false}
                      options={gradeOptions}
                      onChange={(value) => update(row.key, { grade: Number(value) })}
                    />
                    <Select
                      label={tw("subjectLabel")}
                      value={row.subject ?? ""}
                      disabled={locked}
                      options={subjectOptions}
                      onChange={(value) => update(row.key, { subject: value })}
                    />
                  </div>
                  {run.state === "running" && (
                    <ProgressBar
                      value={run.progress * 100}
                      showValue
                      label={t("uploading", { name: row.file.name })}
                    />
                  )}
                  {run.state === "error" && (
                    <p role="alert" className="text-danger text-sm">
                      {errorText(run.error)}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              loading={busy}
              disabled={!ready}
              data-testid="bulk-create"
              onClick={() => void createAll()}
            >
              {t("createAll", { count: pending.length })}
            </Button>
            {busy && (
              <Button variant="secondary" onClick={() => abort.current?.abort()}>
                {t("stop")}
              </Button>
            )}
            {!busy && doneCount > 0 && pending.length === 0 && (
              <Link
                href={ADMIN_ROUTES.pdfBooks}
                className={buttonVariants({ variant: "secondary" })}
              >
                {t("toList")}
              </Link>
            )}
          </div>
        </section>
      )}
    </>
  );
}
