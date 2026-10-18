"use client";

import { useState, type ReactNode } from "react";
import { signIn } from "next-auth/react";
import { useLocale } from "next-intl";
import { Button, type ButtonProps } from "@/components/ui/Button";
import { ROUTES } from "@/lib/utils/routes";

export interface SignInButtonProps extends Omit<ButtonProps, "onClick" | "loading"> {
  /** Kirgandan keyin o'tiladigan to'liq yo'l (til prefiksi bilan). Default: onboarding. */
  redirectPath?: string;
  children: ReactNode;
}

/** Google OAuth'ni boshlaydi. Yangi foydalanuvchi onboarding'ga, qaytganlar rolga mos sahifaga tushadi. */
export function SignInButton({ redirectPath, children, ...props }: SignInButtonProps) {
  const locale = useLocale();
  const [pending, setPending] = useState(false);

  const start = () => {
    setPending(true);
    void signIn("google", { redirectTo: redirectPath ?? `/${locale}${ROUTES.onboarding}` });
  };

  return (
    <Button {...props} loading={pending} onClick={start}>
      {children}
    </Button>
  );
}
