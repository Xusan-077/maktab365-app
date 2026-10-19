import { useMe } from "@/hooks/useMe";
import { effectiveSelection, type TeacherFilterSelection } from "@/lib/utils/teacher-filters";
import { useTeacherStore } from "@/stores/teacher.store";

/** O'qituvchi filtri: tanlanmagan bo'lsa profildagi fanlar va sinflar. */
export function useTeacherSelection(): TeacherFilterSelection & { isCustom: boolean } {
  const { data: me } = useMe();
  const subjects = useTeacherStore((state) => state.subjects);
  const grades = useTeacherStore((state) => state.grades);
  const profile = me?.role === "teacher" ? me : undefined;
  return {
    ...effectiveSelection(
      { subjects, grades },
      { subjects: profile?.subjects, grades: profile?.grades },
    ),
    isCustom: subjects !== null || grades !== null,
  };
}
