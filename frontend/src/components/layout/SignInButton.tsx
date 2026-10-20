"use client";

import { useState, type ReactNode } from "react";
import { signIn } from "next-auth/react";
import { useLocale } from "next-intl";
import { Button, buttonVariants, type ButtonProps } from "@/components/ui/Button";
import { BACKEND_AUTH } from "@/lib/auth/config";
import { Link } from "@/lib/i18n/navigation";
import { ROUTES } from "@/lib/utils/routes";

export interface SignInButtonProps extends Omit<ButtonProps, "onClick" | "loading"> {
  /** Kirgandan keyin o'tiladigan to'liq yo'l (til prefiksi bilan). Default: onboarding. */
  redirectPath?: string;
  /** `google` — darhol Google OAuth. Berilmasa: yangi oqimda kirish sahifasiga havola. */
  provider?: "google";
  children: ReactNode;
}

/**
 * "Kirish" tugmasi. Eski oqimda (va `provider="google"`) Google OAuth'ni boshlaydi: yangi
 * foydalanuvchi onboarding'ga, qaytganlar rolga mos sahifaga tushadi. Yangi oqimda (`BACKEND_AUTH`)
 * header/menyudagi tugma `/kirish` sahifasiga olib boradi (email+parol yoki Google).
 */
export function SignInButton({
  redirectPath,
  provider,
  children,
  variant,
  size,
  className,
  ...props
}: SignInButtonProps) {
  const locale = useLocale();
  const [pending, setPending] = useState(false);

  if (BACKEND_AUTH && provider !== "google") {
    return (
      <Link href={ROUTES.login} className={buttonVariants({ variant, size, className })}>
        {children}
      </Link>
    );
  }

  const start = () => {
    setPending(true);
    void signIn("google", { redirectTo: redirectPath ?? `/${locale}${ROUTES.onboarding}` });
  };

  return (
    <Button
      {...props}
      variant={variant}
      size={size}
      className={className}
      loading={pending}
      onClick={start}
    >
      {children}
    </Button>
  );
}
