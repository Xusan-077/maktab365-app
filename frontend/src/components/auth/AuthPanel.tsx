"use client";

import { useTranslations } from "next-intl";
import { Tabs } from "@/components/ui/Tabs";
import { LoginForm } from "./LoginForm";
import { RegisterForm } from "./RegisterForm";

export type AuthMode = "login" | "register";

/** "Kirish" / "Ro'yxatdan o'tish" tablari (`?mode=register` bilan ikkinchisi ochiladi). */
export function AuthPanel({
  callbackUrl,
  initialMode = "login",
}: {
  callbackUrl?: string;
  initialMode?: AuthMode;
}) {
  const t = useTranslations("authForm");
  return (
    <Tabs
      label={t("tabsLabel")}
      defaultValue={initialMode}
      items={[
        { id: "login", label: t("loginTab"), content: <LoginForm callbackUrl={callbackUrl} /> },
        {
          id: "register",
          label: t("registerTab"),
          content: <RegisterForm callbackUrl={callbackUrl} />,
        },
      ]}
    />
  );
}
