"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { signOut } from "next-auth/react";
import { Download, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/hooks/useToast";
import { getApi } from "@/lib/api";
import { downloadJson } from "@/lib/utils/download";

/** Sozlamalar → Akkaunt: ma'lumotni yuklab olish va akkauntni (tasdiqlash bilan) o'chirish. */
export function AccountDataActions() {
  const t = useTranslations("settings.data");
  const locale = useLocale();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const exportData = useMutation({
    mutationFn: () => getApi().exportData(),
    onSuccess: (data) => downloadJson("darslik365-data.json", data),
    onError: () => toast({ variant: "error", title: t("exportFailed") }),
  });

  const deleteAccount = useMutation({
    mutationFn: () => getApi().deleteAccount(),
    onSuccess: async () => {
      queryClient.clear();
      await signOut({ redirectTo: `/${locale}` });
    },
    onError: () => {
      setConfirmOpen(false);
      toast({ variant: "error", title: t("deleteFailed") });
    },
  });

  return (
    <>
      <div className="flex flex-col gap-2">
        <p className="text-muted text-sm">{t("exportHint")}</p>
        <div>
          <Button
            variant="secondary"
            loading={exportData.isPending}
            onClick={() => exportData.mutate()}
          >
            <Download className="size-4" aria-hidden />
            {t("export")}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-muted text-sm">{t("deleteHint")}</p>
        <div>
          <Button variant="danger" onClick={() => setConfirmOpen(true)}>
            <Trash2 className="size-4" aria-hidden />
            {t("delete")}
          </Button>
        </div>
      </div>

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => !deleteAccount.isPending && setConfirmOpen(open)}
        title={t("confirmTitle")}
        description={t("confirmText")}
      >
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="secondary"
            disabled={deleteAccount.isPending}
            onClick={() => setConfirmOpen(false)}
          >
            {t("cancel")}
          </Button>
          <Button
            variant="danger"
            loading={deleteAccount.isPending}
            onClick={() => deleteAccount.mutate()}
          >
            {t("confirmDelete")}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
