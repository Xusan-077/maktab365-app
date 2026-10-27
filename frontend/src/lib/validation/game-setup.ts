import { array, number, object, string, type InferType } from "yup";
import { QUESTION_COUNTS, TEAM_COUNTS } from "@/lib/games/config";

/** Backend `TEAM_NAME_MAX` bilan bir xil. */
export const TEAM_NAME_MAX = 40;

/**
 * O'yin sozlamalari (modalning 2-qadami). Jamoa nomi bo'sh qolsa standart nom olinadi
 * (`teamNamesFor`), shuning uchun faqat uzunlik tekshiriladi. Xabar kalitlari — `games.modal.errors.*`.
 */
export const gameSetupSchema = object({
  teamCount: number()
    .oneOf([...TEAM_COUNTS])
    .required(),
  teamNames: array(string().trim().max(TEAM_NAME_MAX, "tooLong").default(""))
    .length(TEAM_COUNTS.length)
    .required(),
  questionCount: number()
    .oneOf([...QUESTION_COUNTS])
    .required(),
});

export type GameSetupValues = InferType<typeof gameSetupSchema>;
