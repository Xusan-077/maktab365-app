import { useQuery } from "@tanstack/react-query";
import { authClient } from "@/lib/auth/client";

export const IDENTITIES_KEY = ["auth", "identities"] as const;

/** Ulangan kirish usullari (Sozlamalar → Xavfsizlik). */
export function useIdentities() {
  return useQuery({ queryKey: IDENTITIES_KEY, queryFn: () => authClient.listIdentities() });
}
