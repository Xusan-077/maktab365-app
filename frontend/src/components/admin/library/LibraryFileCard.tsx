"use client";

import { useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileUp, RefreshCw, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAdminErrorText } from "@/components/admin/useAdminErrorText";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { useToast } from "@/hooks/useToast";
import { getAdminLibraryApi, type AdminBook } from "@/lib/library/admin-api";
import { libraryKeys } from "@/lib/library/admin-queries";
import { formatBytes } from "@/lib/utils/bytes";
import { LibraryProgress } from "./LibraryStatus";
import { useBookPdfUpload } from "./useBookPdfUpload";

const BOOK_ERRORS = ["no_file", "invalid_pdf", "render_failed"] as const;

/** PDF yuklash, sahifalarni tayyorlash holati va qayta tayyorlash. */
export function LibraryFileCard({ book }: { book: AdminBook }) {
  const t = useTranslations("admin.library");
  const errorText = useAdminErrorText();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useBookPdfUpload(book.id);
  const uploading = upload.state.phase === "uploading";
  const processing = book.status === "processing";

  const reprocess = useMutation({
    mutationFn: () => getAdminLibraryApi().reprocess(book.id),
    onSuccess: () => {
      toast({ variant: "success", title: t("file.reprocessStarted") });
      void queryClient.invalidateQueries({ queryKey: libraryKeys.root });
    },
  });

  async function onPick(file: File | undefined) {
    if (!file) return;
    if (inputRef.current) inputRef.current.value = "";
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      toast({ variant: "error", title: t("file.notPdf") });
      return;
    }
    if (await upload.run(file)) toast({ variant: "success", title: t("file.uploaded") });
  }

  const failedCode = BOOK_ERRORS.find((code) => code === book.status_error);

  return (
    <section
      aria-labelledby="library-file"
      className="border-border bg-surface flex flex-col gap-3 rounded-xl border p-4"
    >
      <h2 id="library-file" className="font-semibold">
        {t("file.title")}
      </h2>

      {book.has_file && !uploading && book.status === "ready" && (
        <p className="text-muted text-sm tabular-nums">
          {t("file.ready", { pages: book.page_count, size: formatBytes(book.size_bytes) })}
        </p>
      )}
      {book.status === "failed" && book.has_file && failedCode && (
        <p role="alert" className="text-danger text-sm">
          {t(`errors.${failedCode}`)}
        </p>
      )}
      {!uploading && <LibraryProgress book={book} />}

      {uploading && (
        <div className="flex flex-col gap-2">
          <ProgressBar
            value={Math.round(upload.state.progress * 100)}
            label={t("file.uploading", { percent: Math.round(upload.state.progress * 100) })}
          />
          <p className="text-muted text-sm tabular-nums" aria-live="polite">
            {t("file.uploading", { percent: Math.round(upload.state.progress * 100) })}
          </p>
          <Button variant="secondary" size="sm" onClick={upload.cancel} className="self-start">
            <X className="size-4" aria-hidden />
            {t("file.cancel")}
          </Button>
        </div>
      )}

      {upload.state.phase === "error" && (
        <p role="alert" className="text-danger text-sm">
          {errorText(upload.state.error)}
        </p>
      )}
      {reprocess.isError && (
        <p role="alert" className="text-danger text-sm">
          {errorText(reprocess.error)}
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => void onPick(event.target.files?.[0])}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          variant={book.has_file ? "secondary" : "primary"}
          size="sm"
          disabled={uploading || processing}
          onClick={() => inputRef.current?.click()}
        >
          <FileUp className="size-4" aria-hidden />
          {book.has_file ? t("file.replace") : t("file.choose")}
        </Button>
        {book.has_file && book.status !== "ready" && (
          <Button
            variant="secondary"
            size="sm"
            disabled={uploading || processing}
            loading={reprocess.isPending}
            onClick={() => reprocess.mutate()}
          >
            <RefreshCw className="size-4" aria-hidden />
            {t("file.reprocess")}
          </Button>
        )}
      </div>
      {!book.has_file && <p className="text-muted text-sm">{t("file.hint")}</p>}
    </section>
  );
}
