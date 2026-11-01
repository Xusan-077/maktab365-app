"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Clock,
  FileWarning,
  FileX,
  Link2Off,
  Lock,
  ServerCrash,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Link } from "@/lib/i18n/navigation";
import { classifyPdfError, type PdfLoadProblem } from "@/lib/pdf/load-error";
import { ROUTES } from "@/lib/utils/routes";
import { cn } from "@/lib/utils/cn";

const ICONS: Record<PdfLoadProblem | "render", LucideIcon> = {
  offline: WifiOff,
  network: WifiOff,
  timeout: Clock,
  notFound: FileX,
  forbidden: Lock,
  expired: Link2Off,
  damaged: FileWarning,
  server: ServerCrash,
  unknown: AlertTriangle,
  render: AlertTriangle,
};

/** Qayta urinish foydasiz — asosiy harakat «Darsliklar ro'yxatiga». */
const DEAD_END = new Set<PdfLoadProblem | "render">(["notFound", "forbidden", "damaged"]);

function useOnline() {
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine !== false,
  );
  useEffect(() => {
    const update = () => setOnline(navigator.onLine !== false);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

/**
 * Darslik (yoki sahifa) ochilmaganda: sababga qarab tushunarli xabar (internet yo'q, sekin, fayl
 * topilmadi, ruxsat yo'q, havola eskirgan, fayl buzilgan, server) va harakat. PDF'ni brauzerning
 * o'z ko'rgichida ochish yo'li ataylab yo'q — fayl faqat o'qish oynasida ko'rsatiladi.
 */
export function PdfLoadError({
  error,
  render = false,
  onRetry,
  className,
}: {
  error?: unknown;
  /** Hujjat ochilgan, lekin sahifa chizilmadi. */
  render?: boolean;
  onRetry: () => void;
  className?: string;
}) {
  const t = useTranslations("pdfBooks.reader");
  const online = useOnline();
  const problem: PdfLoadProblem | "render" = render ? "render" : classifyPdfError(error, online);
  const Icon = ICONS[problem];
  const deadEnd = DEAD_END.has(problem);

  return (
    <div
      role="alert"
      data-testid="pdf-load-error"
      data-problem={problem}
      className={cn(
        "mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-12 text-center",
        className,
      )}
    >
      <span className="bg-ds-canvas text-ds-muted grid size-14 place-items-center rounded-full">
        <Icon className="size-7" aria-hidden />
      </span>
      <div className="flex flex-col gap-1.5">
        <h2 className="text-ds-ink text-lg font-bold">
          {t(render ? "loadErrors.renderTitle" : "loadErrors.title")}
        </h2>
        <p className="text-ds-muted text-sm">{t(`loadErrors.${problem}`)}</p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {/* Internet yo'q: ulanish tiklanganda o'zi yuklanadi — tugma kutayotgan holatda o'chiq. */}
        <Button
          variant={deadEnd ? "ghost" : "secondary"}
          onClick={onRetry}
          disabled={problem === "offline"}
          data-testid="pdf-load-retry"
        >
          {t("retry")}
        </Button>
        {deadEnd && (
          <Link href={ROUTES.textbooks} className="text-link text-sm font-semibold underline">
            {t("loadErrors.catalog")}
          </Link>
        )}
      </div>
    </div>
  );
}
