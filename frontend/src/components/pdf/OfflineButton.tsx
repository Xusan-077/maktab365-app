"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CloudDownload, CloudOff, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { resolveFileUrl } from "@/lib/pdf/file-url";
import {
  downloadWarnings,
  isOfflineSupported,
  isSavedOffline,
  removeOffline,
  savePdfOffline,
  storageEstimate,
  type OfflineBook,
} from "@/lib/offline/pdf-cache";
import { pdfQueries } from "@/lib/pdf-books/queries";
import { formatBytes } from "@/lib/utils/bytes";

export type OfflineButtonBook = Pick<OfflineBook, "id" | "slug" | "grade" | "title"> & {
  sizeBytes: number;
};

type State =
  | { kind: "unknown" }
  | { kind: "idle" }
  | { kind: "confirm"; warnings: ("large" | "space")[] }
  | { kind: "saving"; progress: number }
  | { kind: "saved" }
  | { kind: "error" };

/**
 * «Oflayn saqlash»: butun PDF qurilma xotirasiga yuklanadi (saqlashdan oldin hajm va xotira haqida
 * ogohlantirish), keyin internetsiz ochiladi. Saqlangan bo'lsa «O'chirish».
 */
export function OfflineButton({ book }: { book: OfflineButtonBook }) {
  const t = useTranslations("offline");
  const queryClient = useQueryClient();
  const [state, setState] = useState<State>({ kind: "unknown" });
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    void isSavedOffline(book.id).then((saved) => {
      if (!cancelled) setState({ kind: saved ? "saved" : "idle" });
    });
    return () => {
      cancelled = true;
      abort.current?.abort();
    };
  }, [book.id]);

  const begin = useCallback(async () => {
    abort.current = new AbortController();
    setState({ kind: "saving", progress: 0 });
    try {
      const { url } = await queryClient.fetchQuery(pdfQueries.fileUrl(book.id));
      await savePdfOffline({
        book: { id: book.id, slug: book.slug, grade: book.grade, title: book.title },
        url: resolveFileUrl(url, window.location.origin),
        expectedBytes: book.sizeBytes,
        signal: abort.current.signal,
        onProgress: (progress) => setState({ kind: "saving", progress }),
      });
      setState({ kind: "saved" });
    } catch (error) {
      setState(
        (error as { name?: string }).name === "AbortError" ? { kind: "idle" } : { kind: "error" },
      );
    }
  }, [book, queryClient]);

  const start = async () => {
    const warnings = downloadWarnings(book.sizeBytes, await storageEstimate());
    if (warnings.length > 0) setState({ kind: "confirm", warnings });
    else void begin();
  };

  if (!isOfflineSupported() || state.kind === "unknown") return null;

  return (
    <div className="flex flex-col items-start gap-2" data-testid="offline-control">
      {state.kind === "idle" && (
        <Button variant="secondary" onClick={() => void start()} data-testid="offline-save">
          <CloudDownload className="size-4" aria-hidden />
          {book.sizeBytes > 0 ? t("saveSize", { size: formatBytes(book.sizeBytes) }) : t("save")}
        </Button>
      )}
      {state.kind === "confirm" && (
        <div
          role="alertdialog"
          aria-label={t("confirmTitle")}
          className="flex max-w-md flex-col gap-2"
        >
          <p className="text-sm" data-testid="offline-warning">
            {state.warnings.includes("large") && (
              <span className="block">{t("warnLarge", { size: formatBytes(book.sizeBytes) })}</span>
            )}
            {state.warnings.includes("space") && <span className="block">{t("warnSpace")}</span>}
          </p>
          <div className="flex gap-2">
            <Button onClick={() => void begin()} data-testid="offline-confirm">
              {t("continue")}
            </Button>
            <Button variant="secondary" onClick={() => setState({ kind: "idle" })}>
              {t("cancel")}
            </Button>
          </div>
        </div>
      )}
      {state.kind === "saving" && (
        <div className="flex w-full max-w-xs items-center gap-2">
          <ProgressBar value={state.progress * 100} showValue label={t("saving")} />
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("stop")}
            onClick={() => abort.current?.abort()}
          >
            <X className="size-4" aria-hidden />
          </Button>
        </div>
      )}
      {state.kind === "saved" && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium" data-testid="offline-saved">
            {t("saved")}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void removeOffline(book.id).then(() => setState({ kind: "idle" }))}
          >
            <CloudOff className="size-4" aria-hidden />
            {t("remove")}
          </Button>
        </div>
      )}
      {state.kind === "error" && (
        <div role="alert" className="flex flex-wrap items-center gap-2">
          <span className="text-danger text-sm">{t("error")}</span>
          <Button variant="secondary" size="sm" onClick={() => void begin()}>
            {t("retry")}
          </Button>
        </div>
      )}
    </div>
  );
}
