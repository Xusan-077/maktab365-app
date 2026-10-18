import { useQuery } from "@tanstack/react-query";
import { apiQueries } from "@/lib/api/queries";
import { useAuth } from "./useAuth";

/** O'quvchining o'qish rejasi maqsadlari (faqat kirgan foydalanuvchi uchun). */
export function useGoals() {
  const { signedIn } = useAuth();
  return useQuery({ ...apiQueries.goals(), enabled: signedIn });
}
