"use client";

import { useState } from "react";
import { Download, ImageDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useAdminIdentity } from "@/components/admin/AdminRoleProvider";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/hooks/useToast";
import {
  downloadCover,
  downloadPdf,
  DownloadError,
  type DownloadTarget,
} from "@/lib/admin/downloads";

export interface DownloadButtonsProps {
  target: DownloadTarget;
  title: string;
  hasFile: boolean;
  hasCover: boolean;
}

/** "PDF yuklab olish" va "Muqovani yuklab olish": faqat admin roli ko'radi (server ham tekshiradi). */
export function DownloadButtons({ target, title, hasFile, hasCover }: DownloadButtonsProps) {
  const t = useTranslations("admin.downloads");
  const { role } = useAdminIdentity();
  const { toast } = useToast();
  const [busy, setBusy] = useState<"pdf" | "cover" | null>(null);
  if (role !== "admin") return null;

  async function run(kind: "pdf" | "cover") {
    setBusy(kind);
    try {
      if (kind === "pdf") await downloadPdf(target);
      else await downloadCover(target, `${title || "muqova"}.webp`);
    } catch (error) {
      const forbidden = error instanceof DownloadError && error.status === 403;
      toast({ variant: "error", title: forbidden ? t("forbidden") : t("failed") });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="secondary"
        size="sm"
        disabled={!hasFile}
        loading={busy === "pdf"}
        onClick={() => void run("pdf")}
      >
        <Download className="size-4" aria-hidden />
        {t("pdf")}
      </Button>
      <Button
        variant="secondary"
        size="sm"
        disabled={!hasCover}
        loading={busy === "cover"}
        onClick={() => void run("cover")}
      >
        <ImageDown className="size-4" aria-hidden />
        {t("cover")}
      </Button>
    </div>
  );
}
