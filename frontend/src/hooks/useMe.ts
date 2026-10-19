import { useQuery } from "@tanstack/react-query";
import { apiQueries } from "@/lib/api/queries";
import { useAuth } from "./useAuth";

/**
 * Profil: kirmagan foydalanuvchi uchun so'rov yuborilmaydi (`data: undefined`);
 * kirgan, lekin onboarding'dan o'tmagan foydalanuvchi uchun `null`.
 */
export function useMe() {
  const { signedIn } = useAuth();
  return useQuery({ ...apiQueries.me(), enabled: signedIn });
}
