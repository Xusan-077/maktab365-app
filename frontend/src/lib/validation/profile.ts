import { array, number, object, string } from "yup";
import { GRADES, type Grade } from "@/types/catalog";
import type { ProfileInput } from "@/types/user";

/** Xabar kalitlari `onboarding.errors.*` ga mos; matnni forma tilga o'giradi. */
export const profileSchema = object({
  role: string().oneOf(["student", "teacher"], "roleRequired").required("roleRequired"),
  name: string().trim().required("nameRequired").max(60, "nameTooLong"),
  grade: number()
    .transform((value: number) => (Number.isNaN(value) ? undefined : value))
    .when("role", {
      is: "student",
      then: (schema) => schema.required("gradeRequired").oneOf([...GRADES], "gradeRequired"),
    }),
  subjects: array()
    .of(string().required())
    .default([])
    .when("role", {
      is: "teacher",
      then: (schema) => schema.min(1, "subjectsRequired"),
    }),
  grades: array()
    .of(
      number()
        .required()
        .oneOf([...GRADES]),
    )
    .default([])
    .when("role", {
      is: "teacher",
      then: (schema) => schema.min(1, "gradesRequired"),
    }),
});

export type ProfileFormValues = {
  role: "student" | "teacher";
  name: string;
  grade?: number;
  subjects: string[];
  /** Checkbox qiymatlari satr bo'lib keladi (RHF), shuning uchun `string | number`. */
  grades: (string | number)[];
};

/** Tekshiruvdan o'tgan forma qiymatlarini rolga mos `ProfileInput` ga aylantiradi. */
export function toProfileInput(values: ProfileFormValues): ProfileInput {
  const name = values.name.trim();
  if (values.role === "student") {
    return { role: "student", name, grade: Number(values.grade) as Grade };
  }
  return {
    role: "teacher",
    name,
    subjects: values.subjects,
    grades: values.grades.map(Number).sort((a, b) => a - b) as Grade[],
  };
}
