"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/layout/ErrorState";

/** Layout (header yoki sidebar) saqlanadi: faqat kontent o'rni almashadi. */
export default function GroupError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <ErrorState variant="error" onRetry={retry} standalone={false} />;
}
