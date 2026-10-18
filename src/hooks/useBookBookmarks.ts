import { useQuery } from "@tanstack/react-query";
import { apiQueries } from "@/lib/api/queries";
import { useAuth } from "./useAuth";

/** O'qituvchi saqlagan kitoblar (faqat kirgan foydalanuvchi uchun). */
export function useBookBookmarks() {
  const { signedIn } = useAuth();
  return useQuery({ ...apiQueries.bookBookmarks(), enabled: signedIn });
}
