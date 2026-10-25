"use client";

import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { NotebookPen, Presentation, RefreshCw, Trash2, Upload, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, buttonVariants } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useToast } from "@/hooks/useToast";
import { getAdminApi } from "@/lib/admin/api";
import type { ChapterRow } from "@/lib/admin/chapters";
import { pdfFileProblem, type PdfFileProblem } from "@/lib/admin/pdf-file";
import { slidesProxyUrl, uploadPdf, xhrSender } from "@/lib/admin/pdf-upload";
import { ADMIN_ROOT_KEY } from "@/lib/admin/queries";
import { adminTopicPath } from "@/lib/admin/routes";
import type { AdminSlides } from "@/lib/admin/types";
import { Link } from "@/lib/i18n/navigation";
import { formatBytes } from "@/lib/utils/bytes";
import { ConfirmDialog } from "./ConfirmDialog";
import { useAdminErrorText } from "./useAdminErrorText";

/** Mundarija muharririga uzatiladigan prezentatsiya konteksti. */
export interface SlidesContext {
  /** Kitob id'si; yo'q (yangi kitob wizard'i) bo'lsa yuklash hali yoqilmaydi. */
  bookId?: string;
  /** Saqlangan bo'lim id'si → joriy prezentatsiya (serverdan; tahrirlanayotgan qatorga bog'liq emas). */
  byId: ReadonlyMap<string, AdminSlides | null>;
  /** Olib tashlash — faqat admin. */
  canDelete: boolean;
}

export interface ChapterSlidesProps {
  context: SlidesContext;
  row: ChapterRow;
  /** Qator tartib raqami ("2" yoki "2.1"): tugma nomlari uchun. */
  position: string;
  disabled?: boolean;
}

type Phase = "idle" | "uploading" | "error";

/**
 * Bo'lim prezentatsiyasi (ixtiyoriy PDF slaydlar): qo'shish/almashtirish (progress, bekor qilish,
 * qayta urinish) va olib tashlash. Mundarija formasidan mustaqil: yuklash xatosi kitobning boshqa
 * maydonlarini saqlashga xalaqit bermaydi.
 */
export function ChapterSlides({ context, row, position, disabled }: ChapterSlidesProps) {
  const t = useTranslations("admin.slides");
  const tp = useTranslations("admin.pdfUpload");
  const tc = useTranslations("admin.common");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const errorText = useAdminErrorText();
  const inputRef = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [problem, setProblem] = useState<PdfFileProblem | null>(null);
  const [uploadError, setUploadError] = useState<unknown>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { bookId } = context;
  const chapterId = row.id;
  const slides = chapterId ? (context.byId.get(chapterId) ?? null) : null;
  const ready = Boolean(bookId && chapterId);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ADMIN_ROOT_KEY });

  async function start(chosen: File) {
    if (!bookId || !chapterId) return;
    const api = getAdminApi();
    controller.current = new AbortController();
    setPhase("uploading");
    setProgress(0);
    setUploadError(null);
    try {
      await uploadPdf({
        api: {
          initPdfUpload: (_id, info) => api.initSlidesUpload(bookId, chapterId, info),
          completePdfUpload: (_id, parts) =>
            api.completeSlidesUpload(bookId, chapterId, parts, chosen.name),
          abortPdfUpload: () => api.abortSlidesUpload(bookId, chapterId),
        },
        send: xhrSender,
        bookId,
        file: chosen,
        proxyUrl: slidesProxyUrl(bookId, chapterId),
        signal: controller.current.signal,
        onProgress: setProgress,
      });
      setPhase("idle");
      setFile(null);
      toast({ variant: "success", title: t("uploaded") });
      await refresh();
    } catch (error) {
      const cancelled = error instanceof DOMException && error.name === "AbortError";
      setPhase(cancelled ? "idle" : "error");
      setUploadError(cancelled ? null : error);
      if (cancelled) setFile(null);
    }
  }

  const remove = useMutation({
    mutationFn: () => getAdminApi().deleteSlides(bookId!, chapterId!),
    onSuccess: async () => {
      await refresh();
      toast({ variant: "success", title: t("deleted") });
      setConfirmOpen(false);
    },
  });

  const busy = phase === "uploading";
  const pick = () => inputRef.current?.click();

  return (
    <div
      className="bg-subtle/50 flex flex-col gap-2 rounded-lg px-3 py-2"
      data-testid="chapter-slides"
      data-has-slides={slides ? "true" : "false"}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Presentation
          className={slides ? "text-link size-4 shrink-0" : "text-muted size-4 shrink-0"}
          aria-hidden
        />
        <div className="min-w-0 flex-1 text-sm">
          {slides ? (
            <p className="truncate" data-testid="slides-info">
              <span className="font-medium">{slides.name || t("label")}</span>
              <span className="text-muted">
                {" · "}
                {t("info", { count: slides.page_count, size: formatBytes(slides.size_bytes) })}
              </span>
            </p>
          ) : (
            <p className="text-muted">{t("optional")}</p>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          tabIndex={-1}
          aria-label={t("choose", { n: position })}
          data-testid="slides-input"
          disabled={!ready || disabled || busy}
          onChange={(event) => {
            const chosen = event.target.files?.[0] ?? null;
            event.target.value = "";
            if (!chosen) return;
            const found = pdfFileProblem(chosen);
            setProblem(found);
            if (found) return;
            setFile(chosen);
            void start(chosen);
          }}
        />
        {bookId && chapterId && (
          <Link
            href={adminTopicPath(bookId, chapterId)}
            aria-label={t("materialsFor", { n: position })}
            data-testid="topic-materials-link"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
          >
            <NotebookPen className="size-4" aria-hidden />
            {t("materials")}
          </Link>
        )}
        {!busy && (
          <Button
            variant="secondary"
            size="sm"
            disabled={!ready || disabled}
            aria-label={t(slides ? "replaceFor" : "addFor", { n: position })}
            onClick={pick}
          >
            {slides ? (
              <RefreshCw className="size-4" aria-hidden />
            ) : (
              <Upload className="size-4" aria-hidden />
            )}
            {t(slides ? "replace" : "add")}
          </Button>
        )}
        {!busy && slides && context.canDelete && (
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            aria-label={t("removeFor", { n: position })}
            onClick={() => {
              remove.reset();
              setConfirmOpen(true);
            }}
          >
            <Trash2 className="size-4" aria-hidden />
            {tc("delete")}
          </Button>
        )}
      </div>

      {!ready && (
        <p className="text-muted text-xs" data-testid="slides-hint">
          {bookId ? t("saveRowFirst") : t("saveBookFirst")}
        </p>
      )}

      {problem && (
        <p role="alert" className="text-danger text-sm">
          {tp(`problems.${problem}`)}
        </p>
      )}

      {busy && (
        <div role="status" className="flex flex-col gap-1.5" data-testid="slides-progress">
          <p className="text-muted text-xs">
            {file?.name} · {t("uploading")}
          </p>
          <div className="flex items-center gap-3">
            <ProgressBar
              className="flex-1"
              value={Math.round(progress * 100)}
              label={t("progress")}
              showValue
            />
            <Button variant="secondary" size="sm" onClick={() => controller.current?.abort()}>
              <X className="size-4" aria-hidden />
              {t("cancel")}
            </Button>
          </div>
        </div>
      )}

      {phase === "error" && (
        <div role="alert" className="flex flex-wrap items-center gap-2" data-testid="slides-error">
          <p className="text-danger text-sm">{errorText(uploadError)}</p>
          {file && (
            <Button variant="secondary" size="sm" onClick={() => void start(file)}>
              <RefreshCw className="size-4" aria-hidden />
              {t("retry")}
            </Button>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("deleteTitle")}
        description={t("deleteDescription", { title: row.title.trim() || position })}
        confirmLabel={tc("delete")}
        pending={remove.isPending}
        error={remove.isError ? errorText(remove.error) : undefined}
        onConfirm={() => remove.mutate()}
      />
    </div>
  );
}
