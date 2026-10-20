"use client";

import { useState } from "react";
import { MailWarning } from "lucide-react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { useAuthErrorText } from "@/hooks/useAuthErrorText";
import { useToast } from "@/hooks/useToast";
import { authClient, errorCodeOf } from "@/lib/auth/client";

/** Email tasdiqlanmagan foydalanuvchiga yengil eslatma (panelni bloklamaydi). */
export function EmailVerifyBanner() {
  const t = useTranslations("authForm.banner");
  const errorText = useAuthErrorText();
  const { toast } = useToast();
  const { data } = useSession();
  const [pending, setPending] = useState(false);

  if (data?.user.emailVerified !== false) return null;

  const resend = async () => {
    setPending(true);
    try {
      await authClient.resendVerification();
      toast({ variant: "success", title: t("sent") });
    } catch (error) {
      toast({ variant: "error", title: errorText(errorCodeOf(error)) ?? "" });
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      role="status"
      data-testid="email-verify-banner"
      className="bg-accent-soft text-accent-soft-foreground flex flex-wrap items-center gap-3 rounded-xl px-4 py-3 text-sm print:hidden"
    >
      <MailWarning className="size-5 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1">{t("text")}</p>
      <Button size="sm" variant="secondary" loading={pending} onClick={() => void resend()}>
        {t("resend")}
      </Button>
    </div>
  );
}
