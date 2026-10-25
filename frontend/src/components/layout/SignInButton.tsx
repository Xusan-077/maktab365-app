"use client";

import type { ReactNode } from "react";
import { buttonVariants, type ButtonProps } from "@/components/ui/Button";
import { useAuthModalStore } from "@/stores/auth-modal.store";

export interface SignInButtonProps extends Pick<ButtonProps, "variant" | "size" | "className"> {
  children: ReactNode;
}

/**
 * "Kirish" tugmasi: yagona "Kirish" oynasini (`AuthModal`, Telegram bot) ochadi. Boshqa usullar
 * (email, Google) oynadagi havola orqali `/kirish` sahifasida.
 */
export function SignInButton({ children, variant, size, className }: SignInButtonProps) {
  const openModal = useAuthModalStore((state) => state.openModal);
  return (
    <button
      type="button"
      onClick={() => openModal()}
      className={buttonVariants({ variant, size, className })}
      data-testid="sign-in-button"
    >
      {children}
    </button>
  );
}
