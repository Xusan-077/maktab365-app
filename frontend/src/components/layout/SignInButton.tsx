import type { ReactNode } from "react";
import { buttonVariants, type ButtonProps } from "@/components/ui/Button";
import { Link } from "@/lib/i18n/navigation";
import { ROUTES } from "@/lib/utils/routes";

export interface SignInButtonProps extends Pick<ButtonProps, "variant" | "size" | "className"> {
  children: ReactNode;
}

/** "Kirish" tugmasi: `/kirish` sahifasiga olib boradi (email+parol, Google, Telegram, email kodi). */
export function SignInButton({ children, variant, size, className }: SignInButtonProps) {
  return (
    <Link href={ROUTES.login} className={buttonVariants({ variant, size, className })}>
      {children}
    </Link>
  );
}
