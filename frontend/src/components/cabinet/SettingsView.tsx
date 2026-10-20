"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { PageHeader } from "@/components/layout/PageHeader";
import { PAGE_STACK } from "@/components/layout/containers";
import { TextSizeControl } from "@/components/layout/TextSizeControl";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { useMe } from "@/hooks/useMe";
import { useToast } from "@/hooks/useToast";
import { useRouter } from "@/lib/i18n/navigation";
import { THEMES } from "@/lib/utils/preferences";
import { dashboardPath } from "@/lib/utils/routes";
import { usePreferencesStore } from "@/stores/preferences.store";
import { AccountDataActions } from "./AccountDataActions";
import { ProfileForm } from "./ProfileForm";
import { SecuritySettings } from "./SecuritySettings";

/** Profil (rol, sinf/fanlar) formasi va ko'rinish sozlamalari: til, theme, matn hajmi. */
export function SettingsView({ googleClientId }: { googleClientId?: string }) {
  const t = useTranslations("settings");
  const tt = useTranslations("theme");
  const locale = useLocale();
  const { data: me } = useMe();
  const { toast } = useToast();
  const router = useRouter();
  const theme = usePreferencesStore((state) => state.theme);
  const setTheme = usePreferencesStore((state) => state.setTheme);

  return (
    <div className={PAGE_STACK}>
      <PageHeader title={t("title")} />

      <div className={`${PAGE_STACK} max-w-2xl`}>
        <section aria-labelledby="settings-profile" className="flex flex-col gap-4">
          <h2 id="settings-profile" className="text-xl font-semibold">
            {t("profile")}
          </h2>
          {/* key: rol almashganda forma yangi profil qiymatlari bilan qayta quriladi */}
          <ProfileForm
            key={me ? `${me.role}-${me.name}` : "empty"}
            initial={me}
            submitLabel={t("save")}
            onSaved={(user) => {
              toast({ variant: "success", title: t("saved") });
              if (me && user.role !== me.role) router.replace(dashboardPath(user.role));
            }}
          />
        </section>

        <section aria-labelledby="settings-appearance" className="flex flex-col gap-5">
          <h2 id="settings-appearance" className="text-xl font-semibold">
            {t("appearance")}
          </h2>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">{t("language")}</p>
            <LanguageSwitcher className="w-fit" />
          </div>
          <div role="group" aria-label={t("theme")} className="flex flex-col gap-2">
            <p className="text-sm font-medium">{t("theme")}</p>
            <div className="flex flex-wrap gap-2">
              {THEMES.map((value) => (
                <Chip key={value} selected={theme === value} onClick={() => setTheme(value)}>
                  {tt(value)}
                </Chip>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">{t("textSize")}</p>
            <TextSizeControl className="w-fit" />
          </div>
        </section>

        <SecuritySettings googleClientId={googleClientId} />

        <section aria-labelledby="settings-about" className="flex flex-col gap-3">
          <h2 id="settings-about" className="text-xl font-semibold">
            {t("about.title")}
          </h2>
          <p className="text-muted">{t("about.text")}</p>
          <ul className="text-muted flex list-disc flex-col gap-1 pl-5">
            <li>{t("about.free")}</li>
            <li>{t("about.topics")}</li>
            <li>{t("about.languages")}</li>
          </ul>
        </section>

        <section aria-labelledby="settings-account" className="flex flex-col gap-3">
          <h2 id="settings-account" className="text-xl font-semibold">
            {t("account")}
          </h2>
          <div>
            <Button variant="secondary" onClick={() => void signOut({ redirectTo: `/${locale}` })}>
              <LogOut className="size-4" aria-hidden />
              {t("signOut")}
            </Button>
          </div>
          <AccountDataActions />
        </section>
      </div>
    </div>
  );
}
