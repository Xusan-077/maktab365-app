import { notFound } from "next/navigation";
import { connection } from "next/server";

/** Yo'l noma'lum, shuning uchun layout'dagi `usePathname()` ham so'rov vaqtida hisoblanadi: bloklanishi mumkin. */
export const instant = false;

/** Mavjud bo'lmagan yo'llarni guruhning not-found sahifasiga yo'naltiradi (layout saqlanadi). */
export default async function CatchAllNotFound() {
  await connection();
  notFound();
}
