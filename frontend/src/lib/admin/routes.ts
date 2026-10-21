import { ROUTES } from "@/lib/utils/routes";

/** Admin sahifalari (til prefiksisiz). */
export const ADMIN_ROUTES = {
  home: ROUTES.admin,
  books: `${ROUTES.admin}/kitoblar`,
  newBook: `${ROUTES.admin}/kitoblar/yangi`,
  newTopic: `${ROUTES.admin}/mavzular/yangi`,
  users: `${ROUTES.admin}/foydalanuvchilar`,
} as const;

export const adminBookPath = (id: string) => `${ADMIN_ROUTES.books}/${id}`;
export const adminTopicPath = (id: string) => `${ROUTES.admin}/mavzular/${id}`;
export const adminNewTopicPath = (bookId: string, chapterId: string) =>
  `${ADMIN_ROUTES.newTopic}?${new URLSearchParams({ book: bookId, chapter: chapterId })}`;
