"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { getSession, signIn } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { EASE_OUT, m } from "@/components/ui/motion";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { GOOGLE_PROVIDER } from "@/lib/auth/config";
import { Link } from "@/lib/i18n/navigation";
import { ROUTES } from "@/lib/utils/routes";
import { useAuthModalStore } from "@/stores/auth-modal.store";
import { GoogleIcon } from "./GoogleIcon";
import { TelegramLoginPanel } from "./TelegramLoginPanel";

/**
 * Yagona "Kirish" oynasi (alohida ro'yxatdan o'tish yo'q): Google va Telegram bot orqali kirish.
 * Google — OAuth yo'naltirish, qaytgach `/onboarding` (profili bor bo'lsa proxy panelga o'tkazadi,
 * xuddi `/kirish` dagi kabi; kutilgan amal yo'naltirishda saqlanmaydi). Mobilda pastki
 * sheet, desktopda markazda 420px karta. Yopilganda ichki holat (va polling) butunlay tashlanadi.
 * Kirgach: onboarding tugamagan bo'lsa `/onboarding`, aks holda kutilgan amal (`onSuccess`) bajariladi.
 */
export function AuthModal() {
  const t = useTranslations("authModal");
  const tf = useTranslations("authForm");
  const [googlePending, setGooglePending] = useState(false);
  const open = useAuthModalStore((state) => state.open);
  const reason = useAuthModalStore((state) => state.reason);
  const close = useAuthModalStore((state) => state.close);
  const mobile = useMediaQuery("(max-width: 767px)");
  const router = useRouter();
  const locale = useLocale();

  const onSignedIn = useCallback(async () => {
    const { onSuccess } = useAuthModalStore.getState();
    close();
    const user = (await getSession())?.user;
    if (user?.onboarded === false) {
      router.push(`/${locale}${ROUTES.onboarding}`);
      return;
    }
    onSuccess?.();
    router.refresh();
  }, [close, router, locale]);

  const google = () => {
    setGooglePending(true);
    void signIn(GOOGLE_PROVIDER, { redirectTo: `/${locale}${ROUTES.onboarding}` });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && close()}
      title={t("title")}
      description={t(`reason.${reason}`)}
      placement={mobile ? "bottom" : "center"}
      className={mobile ? "pb-[env(safe-area-inset-bottom)]" : "max-w-[420px]"}
    >
      {open && (
        <m.div
          initial={{ opacity: 0, y: mobile ? 24 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: EASE_OUT }}
          className="flex flex-col gap-4"
          data-testid="auth-modal"
        >
          <Button
            variant="secondary"
            size="lg"
            loading={googlePending}
            onClick={google}
            className="h-13 w-full rounded-xl"
          >
            {!googlePending && <GoogleIcon className="size-5" />}
            {tf("google")}
          </Button>
          <TelegramLoginPanel onSignedIn={onSignedIn} />
          <p className="text-muted text-center text-xs">{t("guestNote")}</p>
          <Link
            href={ROUTES.login}
            onClick={close}
            className="text-link text-center text-sm font-medium hover:underline"
          >
            {t("otherMethods")}
          </Link>
        </m.div>
      )}
    </Dialog>
  );
}
