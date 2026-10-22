import { object, string } from "yup";

export const GOAL_TITLE_MAX = 200;

export interface GoalFormValues {
  title: string;
  /** `YYYY-MM-DD` yoki bo'sh. */
  dueDate: string;
}

/** Xabar kalitlari `library.goals.errors.*` ga mos. */
export function createGoalSchema() {
  return object({
    title: string().trim().required("required").max(GOAL_TITLE_MAX, "tooLong"),
    dueDate: string().default(""),
  });
}
