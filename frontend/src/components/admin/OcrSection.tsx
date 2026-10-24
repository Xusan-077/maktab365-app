"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/hooks/useToast";
import { getAdminApi } from "@/lib/admin/api";
import { adminKeys, adminQueries } from "@/lib/admin/queries";
import type { AdminPdfBook } from "@/lib/admin/types";
import type { Locale } from "@/lib/i18n/config";
import { formatDate } from "@/lib/utils/format-date";
import { useAdminErrorText } from "./useAdminErrorText";

/** OCR navbatda/bajarilayotganda holat shu oraliqda qayta so'raladi. */
const POLL_MS = 5000;

type OcrStatus = AdminPdfBook["ocr_status"];

const STATUS_VARIANT: Record<Exclude<OcrStatus, "none">, BadgeVariant> = {
  queued: "neutral",
  processing: "primary",
  done: "success",
  failed: "danger",
};

const OCR_ERRORS = ["ocr_not_implemented", "ocr_failed", "no_file"] as const;

const isOcrActive = (status: OcrStatus) => status === "queued" || status === "processing";

/**
 * Matn qatlami (kitob ichidan qidiruv) holati va OCR: matn qatlami yo'q kitobni OCR'ga yuborish,
 * holatni kuzatish (navbatda/bajarilmoqda bo'lsa avtomatik yangilanadi). Fayl yo'q bo'lsa ko'rinmaydi.
 */
export function OcrSection({ book: initial }: { book: AdminPdfBook }) {
  const t = useTranslations("admin.ocr");
  const locale = useLocale() as Locale;
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const errorText = useAdminErrorText();
  // Sahifa bilan bir xil kalit: faqat OCR faol bo'lganda shu kuzatuvchi qayta so'raydi.
  const { data: book = initial } = useQuery({
    ...adminQueries.pdfBook(initial.id),
    initialData: initial,
    refetchInterval: (query) =>
      query.state.data && isOcrActive(query.state.data.ocr_status) ? POLL_MS : false,
  });
  const request = useMutation({
    mutationFn: () => getAdminApi().requestOcr(book.id),
    onSuccess: (updated) => {
      queryClient.setQueryData(adminKeys.pdfBook(book.id), updated);
      toast({ variant: "success", title: t("queued") });
    },
    onError: (error) => toast({ variant: "error", title: errorText(error) }),
  });

  if (!book.has_file) return null;
  const status = book.ocr_status;
  const active = isOcrActive(status);
  const layer = book.has_text_layer === null ? "unknown" : book.has_text_layer ? "yes" : "no";
  const error = (OCR_ERRORS as readonly string[]).includes(book.ocr_error)
    ? t(`errors.${book.ocr_error as (typeof OCR_ERRORS)[number]}`)
    : t("errors.generic");

  return (
    <section className="flex flex-col gap-3" aria-labelledby="pdf-ocr" data-testid="ocr-section">
      <h2 id="pdf-ocr" className="text-lg font-semibold">
        {t("title")}
      </h2>
      <p className="text-sm" data-testid="text-layer-status">
        {t(`textLayer.${layer}`)}
      </p>
      {status !== "none" && (
        <div className="flex flex-wrap items-center gap-2 text-sm" aria-live="polite">
          <Badge variant={STATUS_VARIANT[status]} data-testid="ocr-status">
            {t(`status.${status}`)}
          </Badge>
          {book.ocr_updated_at && (
            <time className="text-muted" dateTime={book.ocr_updated_at}>
              {formatDate(book.ocr_updated_at, locale, "dateTime")}
            </time>
          )}
          {status === "failed" && (
            <span className="text-danger" data-testid="ocr-error">
              {error}
            </span>
          )}
        </div>
      )}
      {book.has_text_layer === false && (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            data-testid="ocr-request"
            loading={request.isPending}
            disabled={!book.ocr_available || active}
            onClick={() => request.mutate()}
          >
            {t(status === "failed" || status === "done" ? "retry" : "action")}
          </Button>
          {!book.ocr_available && <p className="text-muted text-sm">{t("unavailable")}</p>}
        </div>
      )}
    </section>
  );
}
