import { ROUTES } from "@/lib/utils/routes";

/** Admin sahifalari (til prefiksisiz). Kitoblar — PDF darsliklar. */
export const ADMIN_ROUTES = {
  home: ROUTES.admin,
  pdfBooks: `${ROUTES.admin}/kitoblar`,
  newPdfBook: `${ROUTES.admin}/kitoblar/yangi`,
  subjects: `${ROUTES.admin}/fanlar`,
  stats: `${ROUTES.admin}/statistika`,
  users: `${ROUTES.admin}/foydalanuvchilar`,
} as const;

export const adminPdfBookPath = (id: string) => `${ADMIN_ROUTES.pdfBooks}/${id}`;
