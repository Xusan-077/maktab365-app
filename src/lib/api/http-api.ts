import { ApiError, type MaktabApi } from "./types";

const notImplemented = (method: string) => async (): Promise<never> => {
  throw new ApiError(`HttpApi.${method} hali yozilmagan (DRF endpoint'lari kutilmoqda)`, 501);
};

/** DRF klienti uchun joy. Endpoint'lar tayyor bo'lganda har bir metod haqiqiy so'rovga almashtiriladi. */
export class HttpApi implements MaktabApi {
  getGrades = notImplemented("getGrades");
  getSubjects = notImplemented("getSubjects");
  getBooks = notImplemented("getBooks");
  getBook = notImplemented("getBook");
  getChapters = notImplemented("getChapters");
  getTopic = notImplemented("getTopic");
  searchTopics = notImplemented("searchTopics");
  getProgress = notImplemented("getProgress");
  saveProgress = notImplemented("saveProgress");
  getBookmarks = notImplemented("getBookmarks");
  toggleBookmark = notImplemented("toggleBookmark");
  setBookmark = notImplemented("setBookmark");
  getBookBookmarks = notImplemented("getBookBookmarks");
  toggleBookBookmark = notImplemented("toggleBookBookmark");
  getMe = notImplemented("getMe");
  saveProfile = notImplemented("saveProfile");
  updateProfile = notImplemented("updateProfile");
  getGoals = notImplemented("getGoals");
  createGoal = notImplemented("createGoal");
  updateGoal = notImplemented("updateGoal");
  deleteGoal = notImplemented("deleteGoal");
  submitFeedback = notImplemented("submitFeedback");
}
