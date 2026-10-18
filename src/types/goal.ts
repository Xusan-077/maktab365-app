/** O'quvchi o'zi qo'shadigan kichik o'qish maqsadi (o'qish rejasi). */
export type StudyGoal = {
  id: string;
  userId: string;
  title: string;
  done: boolean;
  /** ISO sana. */
  createdAt: string;
};

export type UpdateGoalInput = {
  title?: string;
  done?: boolean;
};
