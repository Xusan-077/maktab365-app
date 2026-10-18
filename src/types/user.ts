import type { Grade } from "./catalog";

export type UserRole = "student" | "teacher";

type UserBase = { id: string; name: string };

export type StudentUser = UserBase & { role: "student"; grade?: Grade };

export type TeacherUser = UserBase & {
  role: "teacher";
  /** Fan id'lari. */
  subjects?: string[];
  grades?: Grade[];
};

export type User = StudentUser | TeacherUser;

/** Onboarding va sozlamalar formasi natijasi: rolga qarab to'liq profil. */
export type ProfileInput =
  | { role: "student"; name: string; grade: Grade }
  | { role: "teacher"; name: string; subjects: string[]; grades: Grade[] };

/** Profilni qisman yangilash; rolga mos kelmaydigan maydonlar e'tiborga olinmaydi. */
export type UpdateProfileInput = {
  name?: string;
  grade?: Grade;
  subjects?: string[];
  grades?: Grade[];
};
