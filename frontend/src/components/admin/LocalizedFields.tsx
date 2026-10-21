"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/Input";
import type { LocalizedText } from "@/types/i18n";

export interface LocalizedFieldsProps {
  label: string;
  /** Test va label id'lari uchun prefiks. */
  name: string;
  value: LocalizedText;
  onChange: (value: LocalizedText) => void;
  /** `uz` majburiy; ru/en ixtiyoriy. */
  error?: string;
  disabled?: boolean;
}

const LANGS = ["uz", "ru", "en"] as const;

/** Ko'p tilli matn kiritish: uz (majburiy), ru, en. Bo'sh tarjimalar yuborilmaydi (`toLocalized`). */
export function LocalizedFields({
  label,
  name,
  value,
  onChange,
  error,
  disabled,
}: LocalizedFieldsProps) {
  const t = useTranslations("admin.localized");
  return (
    <fieldset className="flex flex-col gap-3" disabled={disabled}>
      <legend className="text-foreground mb-1 text-sm font-medium">{label}</legend>
      <div className="grid gap-3 sm:grid-cols-3">
        {LANGS.map((lang) => (
          <Input
            key={lang}
            id={`${name}-${lang}`}
            label={t(lang)}
            value={value[lang] ?? ""}
            onChange={(event) => onChange({ ...value, [lang]: event.target.value })}
            error={lang === "uz" ? error : undefined}
            autoComplete="off"
          />
        ))}
      </div>
    </fieldset>
  );
}

/** Bo'sh ru/en tarjimalarni tashlab, `uz` ni qirqadi. */
export function toLocalized(value: LocalizedText): LocalizedText {
  const result: LocalizedText = { uz: value.uz.trim() };
  const ru = value.ru?.trim();
  const en = value.en?.trim();
  if (ru) result.ru = ru;
  if (en) result.en = en;
  return result;
}
