import { useQuery } from "@tanstack/react-query";
import { apiQueries } from "@/lib/api/queries";
import { useAuth } from "./useAuth";

/** O'qituvchi bosh sahifasi (`GET /me/teacher/dashboard/`): yaqinda ochilgan va saqlangan materiallar. */
export function useTeacherDashboard() {
  const { signedIn } = useAuth();
  return useQuery({ ...apiQueries.teacherDashboard(), enabled: signedIn });
}
