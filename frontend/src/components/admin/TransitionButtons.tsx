"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Button, type ButtonVariant } from "@/components/ui/Button";
import { useToast } from "@/hooks/useToast";
import { getAdminApi } from "@/lib/admin/api";
import { transitionsFor, type TransitionAction } from "@/lib/admin/permissions";
import { ADMIN_ROOT_KEY } from "@/lib/admin/queries";
import type { TopicStatus } from "@/lib/admin/types";
import { useAdminIdentity } from "./AdminRoleProvider";
import { useAdminErrorText } from "./useAdminErrorText";

const VARIANTS: Record<TransitionAction, ButtonVariant> = {
  review: "secondary",
  publish: "primary",
  unpublish: "ghost",
};

export interface TransitionButtonsProps {
  topicId: string;
  status: TopicStatus;
  size?: "sm" | "md";
}

/** Nashr oqimi tugmalari: faqat joriy rol bajara oladigan o'tishlar ko'rsatiladi. */
export function TransitionButtons({ topicId, status, size = "sm" }: TransitionButtonsProps) {
  const t = useTranslations("admin.transition");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { role } = useAdminIdentity();
  const errorText = useAdminErrorText();

  const transition = useMutation({
    mutationFn: ({ to }: { to: TopicStatus; action: TransitionAction }) =>
      getAdminApi().transition(topicId, to),
    onSuccess: async (_topic, { action }) => {
      await queryClient.invalidateQueries({ queryKey: ADMIN_ROOT_KEY });
      toast({ variant: "success", title: t(`done.${action}`) });
    },
    onError: (error) => toast({ variant: "error", title: errorText(error) }),
  });

  const options = transitionsFor(role, status);
  if (options.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {options.map(({ to, action }) => (
        <Button
          key={to}
          size={size}
          variant={VARIANTS[action]}
          loading={transition.isPending && transition.variables?.to === to}
          disabled={transition.isPending}
          onClick={() => transition.mutate({ to, action })}
        >
          {t(action)}
        </Button>
      ))}
    </div>
  );
}
