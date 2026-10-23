"use client";

import { Eye } from "lucide-react";
import { useTranslations } from "next-intl";
import { PdfReaderLoader } from "@/components/pdf/PdfReaderLoader";
import { adminPdfBookPath } from "@/lib/admin/routes";
import { Link } from "@/lib/i18n/navigation";

/**
 * Qoralama (yoki nashr qilingan) kitobni o'quvchi o'qish oynasida ko'rsatadi. Admin ochiq saytga
 * chiqmaydi, shuning uchun o'qish oynasi admin qobig'ida; orqaga havola tahrirlashga qaytaradi.
 */
export function AdminBookPreview({ id }: { id: string }) {
  const t = useTranslations("admin.pdfEdit");
  return (
    <div className="flex flex-col gap-4">
      <div
        role="note"
        className="bg-accent-soft text-accent-soft-foreground flex flex-wrap items-center gap-3 rounded-lg px-4 py-3 text-sm"
      >
        <Eye className="size-4 shrink-0" aria-hidden />
        <p className="min-w-0 flex-1">{t("previewBanner")}</p>
        <Link href={adminPdfBookPath(id)} className="font-medium underline underline-offset-4">
          {t("previewBack")}
        </Link>
      </div>
      <PdfReaderLoader bookId={id} backHref={adminPdfBookPath(id)} />
    </div>
  );
}
