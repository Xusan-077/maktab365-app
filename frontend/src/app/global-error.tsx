"use client";

import { useEffect } from "react";
import Image from "next/image";
import { defaultLocale, isLocale, type Locale } from "@/lib/i18n/config";
import { transliterateMessage } from "@/lib/i18n/translit";
import { PREFERENCES_INIT_SCRIPT } from "@/lib/utils/preferences";
import en from "@/lib/i18n/messages/en.json";
import ru from "@/lib/i18n/messages/ru.json";
import uz from "@/lib/i18n/messages/uz.json";
import "./globals.css";

type ErrorMessages = typeof uz.errors;

/** Provider'lar ishlamaydigan joy: xabarlar to'g'ridan-to'g'ri JSON'dan, til URL'ning birinchi qismidan olinadi. */
function localeFromPath(): Locale {
  const first = window.location.pathname.split("/")[1];
  return isLocale(first) ? first : defaultLocale;
}

function messagesFor(locale: Locale): ErrorMessages {
  if (locale === "ru") return ru.errors;
  if (locale === "en") return en.errors;
  if (locale === "uz-Cyrl") {
    return {
      ...uz.errors,
      title: transliterateMessage(uz.errors.title),
      text: transliterateMessage(uz.errors.text),
      retry: transliterateMessage(uz.errors.retry),
      home: transliterateMessage(uz.errors.home),
    };
  }
  return uz.errors;
}

/** Ildiz layout'dagi xato uchun oxirgi himoya: o'z `<html>`i bilan, provider'siz. */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const locale = typeof window === "undefined" ? defaultLocale : localeFromPath();
  const t = messagesFor(locale);

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: PREFERENCES_INIT_SCRIPT }} />
      </head>
      <body className="bg-background text-foreground min-h-dvh font-sans antialiased">
        <main className="mx-auto flex max-w-xl flex-col items-center gap-6 px-4 py-24 text-center">
          <Image
            src="/logo-horizontal.svg"
            alt=""
            width={189}
            height={36}
            unoptimized
            className="dark:hidden"
          />
          <Image
            src="/logo-horizontal-dark.svg"
            alt=""
            width={189}
            height={36}
            unoptimized
            className="hidden dark:block"
          />
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{t.title}</h1>
          <p className="text-muted text-lg">{t.text}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => retry()}
              className="bg-primary-600 hover:bg-primary-700 h-10 rounded-lg px-4 text-sm font-medium text-white"
            >
              {t.retry}
            </button>
            <a
              href={`/${locale}`}
              className="border-border bg-surface hover:bg-subtle inline-flex h-10 items-center rounded-lg border px-4 text-sm font-medium"
            >
              {t.home}
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
