"use client";

import { useCallback, useEffect, useState } from "react";
import { CloudOff, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { buttonVariants, Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Locale } from "@/lib/i18n/config";
import { getLocalized } from "@/lib/i18n/localized";
import { Link } from "@/lib/i18n/navigation";
import {
  clearOffline,
  isOfflineSupported,
  readRegistry,
  removeOffline,
  storageEstimate,
  totalOfflineBytes,
  type OfflineBook,
  type StorageInfo,
} from "@/lib/offline/pdf-cache";
import { formatBytes } from "@/lib/utils/bytes";
import { readerPath, ROUTES } from "@/lib/utils/routes";

/** Oflayn saqlangan kitoblar: hajm, xotira va har birini o'chirish (yoki hammasini). */
export function OfflineManager() {
  const t = useTranslations("offline");
  const locale = useLocale() as Locale;
  const [items, setItems] = useState<OfflineBook[] | null>(null);
  const [storage, setStorage] = useState<StorageInfo | null>(null);

  const refresh = useCallback(async () => {
    const estimate = await storageEstimate();
    setItems(readRegistry());
    setStorage(estimate);
  }, []);
  useEffect(() => {
    let alive = true;
    void storageEstimate().then((estimate) => {
      if (!alive) return;
      setItems(readRegistry());
      setStorage(estimate);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (items === null) return null;
  if (!isOfflineSupported()) {
    return <p className="text-muted text-sm">{t("unsupported")}</p>;
  }
  if (items.length === 0) {
    return (
      <EmptyState
        icon={CloudOff}
        action={
          <Link href={ROUTES.textbooks} className={buttonVariants({ variant: "secondary" })}>
            {t("toCatalog")}
          </Link>
        }
      >
        {t("empty")}
      </EmptyState>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted text-sm tabular-nums" data-testid="offline-usage">
        {t("usage", { count: items.length, size: formatBytes(totalOfflineBytes(items)) })}
        {storage && storage.quota > 0 && (
          <>
            {" "}
            · {t("quota", { used: formatBytes(storage.usage), total: formatBytes(storage.quota) })}
          </>
        )}
      </p>
      <ul className="border-border bg-surface divide-border divide-y rounded-xl border">
        {items.map((book) => (
          <li key={book.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <Link
                href={readerPath(book)}
                className="text-link font-medium underline-offset-4 hover:underline"
              >
                {getLocalized(book.title, locale)}
              </Link>
              <p className="text-muted text-sm">
                {t("meta", { grade: book.grade, size: formatBytes(book.sizeBytes) })}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              aria-label={t("removeBook", { title: getLocalized(book.title, locale) })}
              onClick={() => void removeOffline(book.id).then(refresh)}
            >
              <Trash2 className="size-4" aria-hidden />
              {t("remove")}
            </Button>
          </li>
        ))}
      </ul>
      <div>
        <Button variant="danger" onClick={() => void clearOffline().then(refresh)}>
          {t("clearAll")}
        </Button>
      </div>
    </div>
  );
}
