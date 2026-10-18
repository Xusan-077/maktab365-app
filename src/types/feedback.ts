export const FEEDBACK_KINDS = ["question", "idea", "bug"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

/** Panelning "Yordam" sahifasidan yuboriladigan xabar: savol, taklif yoki xatolik haqida. */
export type FeedbackInput = {
  kind: FeedbackKind;
  message: string;
};

export type Feedback = FeedbackInput & {
  id: string;
  userId: string;
  /** ISO sana. */
  createdAt: string;
};
