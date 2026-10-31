"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/hooks/useToast";
import { getPathname } from "@/lib/i18n/navigation";
import { quizPaths } from "@/lib/utils/routes";

/** Ochiq test havolasini nusxalaydi (faqat `visibility = public` testlar uchun ko'rsatiladi). */
export function ShareLinkButton({ quizId }: { quizId: string }) {
  const t = useTranslations("quizzes.card");
  const locale = useLocale();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  async function copy() {
    const path = getPathname({ href: quizPaths.publicQuiz(quizId), locale });
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setCopied(true);
      toast({ variant: "success", title: t("linkCopied") });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ variant: "error", title: t("linkCopyFailed") });
    }
  }

  return (
    <Button variant="secondary" size="sm" onClick={copy}>
      {copied ? <Check className="size-4" aria-hidden /> : <Link2 className="size-4" aria-hidden />}
      {t("copyLink")}
    </Button>
  );
}
