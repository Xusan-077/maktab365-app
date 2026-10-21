import { useQuery } from "@tanstack/react-query";
import { apiQueries } from "@/lib/api/queries";
import { useAuth } from "./useAuth";

/** "Natijalar" (`GET /me/results/`): mavzu kesimida, faqat kirgan foydalanuvchi uchun. */
export function useResults() {
  const { signedIn } = useAuth();
  return useQuery({ ...apiQueries.results(), enabled: signedIn });
}
