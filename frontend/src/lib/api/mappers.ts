import type { components } from "./schema";
import { GRADES, type Grade } from "@/types/catalog";
import type { ProfileInput, UpdateProfileInput, User } from "@/types/user";

type Me = components["schemas"]["Me"];
type OnboardingRequest = components["schemas"]["OnboardingRequest"];
type ProfileUpdateRequest = components["schemas"]["PatchedProfileUpdateRequest"];

const isGrade = (value: number): value is Grade => (GRADES as readonly number[]).includes(value);

/**
 * Backend `Me` → frontend `User`. Panelda faqat ikki rol bor: `student` va `teacher`;
 * `editor`/`admin` (kontent va staff) o'qituvchi paneli bilan ishlaydi.
 */
export function toUser(me: Me): User {
  const { profile } = me;
  const name = profile.display_name;
  if (me.role === "student") {
    return {
      id: me.id,
      role: "student",
      name,
      ...(profile.grade !== null && isGrade(profile.grade) && { grade: profile.grade }),
    };
  }
  return {
    id: me.id,
    role: "teacher",
    name,
    subjects: profile.subjects,
    grades: profile.grades.filter(isGrade),
  };
}

/** Onboarding tugamagan bo'lsa `null` (frontend shu bilan `/onboarding` ga yo'naltiradi). */
export const toOnboardedUser = (me: Me): User | null =>
  me.profile.onboarded_at ? toUser(me) : null;

export function toOnboardingRequest(input: ProfileInput): OnboardingRequest {
  return input.role === "student"
    ? { role: "student", display_name: input.name.trim(), grade: input.grade }
    : {
        role: "teacher",
        display_name: input.name.trim(),
        subjects: input.subjects,
        grades: input.grades,
      };
}

export function toProfileUpdateRequest(input: UpdateProfileInput): ProfileUpdateRequest {
  return {
    ...(input.name !== undefined && { display_name: input.name.trim() }),
    ...(input.grade !== undefined && { grade: input.grade }),
    ...(input.subjects !== undefined && { subjects: input.subjects }),
    ...(input.grades !== undefined && { grades: input.grades }),
  };
}
