import { useQuery } from "@tanstack/react-query";
import { apiQueries } from "@/lib/api/queries";
import { useAuth } from "./useAuth";

/** O'quvchi kabineti bosh sahifasi (`GET /me/dashboard/`): faqat kirgan foydalanuvchi uchun. */
export function useDashboard() {
  const { signedIn } = useAuth();
  return useQuery({ ...apiQueries.dashboard(), enabled: signedIn });
}
