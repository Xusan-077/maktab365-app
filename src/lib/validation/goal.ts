import { object, string } from "yup";

export const GOAL_TITLE_MAX = 120;

/** Xabar kalitlari `cabinet.plan.errors.*` ga mos; matnni forma tilga o'giradi. */
export const goalSchema = object({
  title: string().trim().required("titleRequired").max(GOAL_TITLE_MAX, "titleTooLong"),
});

export type GoalFormValues = { title: string };
