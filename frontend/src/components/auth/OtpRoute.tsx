"use client";

import { useSearchParams } from "next/navigation";
import { safeCallbackPath } from "@/lib/utils/routes";
import { OtpView } from "./OtpView";

/** `/kod?email=…&callbackUrl=…` parametrlarini o'qib, kod kiritish ko'rinishini ochadi. */
export function OtpRoute() {
  const searchParams = useSearchParams();
  return (
    <OtpView
      email={searchParams.get("email")?.trim() || undefined}
      callbackUrl={safeCallbackPath(searchParams.get("callbackUrl"))}
    />
  );
}
