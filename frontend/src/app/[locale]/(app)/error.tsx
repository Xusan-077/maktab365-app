"use client";

import { useEffect } from "react";
import { ApiError } from "@/lib/api/types";
import { ErrorState } from "@/components/layout/ErrorState";

/** Layout (header yoki sidebar) saqlanadi: faqat kontent o'rni almashadi. */
export default function GroupError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      variant={error instanceof ApiError && error.status === 403 ? "forbidden" : "error"}
      onRetry={retry}
      standalone={false}
    />
  );
}
