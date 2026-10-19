"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Copy, Maximize2, Minimize2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/hooks/useToast";
import { cn } from "@/lib/utils/cn";
import { toPublicPath } from "@/lib/utils/routes";

// qrcode.react faqat dialog ochilganda yuklanadi: mavzu sahifasi yengil qoladi.
const QrImage = dynamic(() => import("./QrImage"), {
  ssr: false,
  loading: () => <Skeleton className="aspect-square w-full" />,
});

export interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Joriy mavzu havolasi: nusxalash va (katta ko'rinishga o'tadigan) QR kod. */
export function ShareDialog({ open, onOpenChange }: ShareDialogProps) {
  const t = useTranslations("topic.teacher.share");
  const { toast } = useToast();
  const [large, setLarge] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  // Dialog yopiq paytda `window` ga tegmaymiz; ochiq paytda manzil o'qiladi (hash va query'siz).
  // Panel manzili emas, ochiq sayt manzili beriladi: o'quvchi kirmasdan ocha oladi.
  const url = open ? `${window.location.origin}${toPublicPath(window.location.pathname)}` : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast({ variant: "success", title: t("copied") });
    } catch {
      input.current?.select();
      toast({ variant: "error", title: t("copyFailed") });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setLarge(false);
        onOpenChange(next);
      }}
      title={t("title")}
      description={t("description")}
      className={large ? "w-[calc(100%-1rem)] max-w-none" : undefined}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          <input
            ref={input}
            readOnly
            value={url}
            aria-label={t("linkLabel")}
            onFocus={(event) => event.currentTarget.select()}
            className="border-border bg-surface h-10 min-w-0 flex-1 rounded-lg border px-3 text-sm"
          />
          <Button onClick={copy}>
            <Copy className="size-4" aria-hidden />
            {t("copy")}
          </Button>
        </div>

        {open && (
          <div
            className={cn(
              "mx-auto w-full rounded-lg bg-white",
              large ? "max-w-[min(80vw,75dvh)]" : "max-w-72",
            )}
          >
            <QrImage value={url} label={t("qrLabel")} />
          </div>
        )}

        <Button
          variant="secondary"
          aria-pressed={large}
          onClick={() => setLarge((value) => !value)}
        >
          {large ? (
            <Minimize2 className="size-4" aria-hidden />
          ) : (
            <Maximize2 className="size-4" aria-hidden />
          )}
          {large ? t("smaller") : t("larger")}
        </Button>
      </div>
    </Dialog>
  );
}
