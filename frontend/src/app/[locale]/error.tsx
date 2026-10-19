"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/layout/ErrorState";

export default function LocaleError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <ErrorState variant="error" onRetry={retry} />;
}
