import { ROUTES } from "@/lib/utils/routes";

/** Admin sahifalari (til prefiksisiz). Kitoblar — PDF darsliklar. */
export const ADMIN_ROUTES = {
  home: ROUTES.admin,
  pdfBooks: `${ROUTES.admin}/kitoblar`,
  newPdfBook: `${ROUTES.admin}/kitoblar/yangi`,
  bulkPdfBooks: `${ROUTES.admin}/kitoblar/ommaviy`,
  subjects: `${ROUTES.admin}/fanlar`,
  stats: `${ROUTES.admin}/statistika`,
  users: `${ROUTES.admin}/foydalanuvchilar`,
  messages: `${ROUTES.admin}/xabarlar`,
} as const;

export const adminPdfBookPath = (id: string) => `${ADMIN_ROUTES.pdfBooks}/${id}`;
/** Qoralamani o'quvchi ko'rinishida oldindan ko'rish (admin qobig'ida). */
export const adminPdfBookPreviewPath = (id: string) => `${adminPdfBookPath(id)}/korish`;
/** Mavzu (mundarija bo'limi) materiallari: Xulosa, Taqdimot… */
export const adminTopicPath = (bookId: string, topicId: string) =>
  `${adminPdfBookPath(bookId)}/mavzu/${topicId}`;
