import { notFound } from "next/navigation";
import { routing } from "@/lib/i18n/routing";

/** Namuna yo'l: parametr ma'lum bo'lgani uchun sahifa Suspense'siz, haqiqiy 404 status bilan javob beradi. */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale, rest: ["yoq"] }));
}

/** Yo'l noma'lum, shuning uchun layout'dagi `usePathname()` so'rov vaqtida hisoblanadi: bloklanishi mumkin. */
export const instant = false;

/** Mavjud bo'lmagan yo'llarni guruhning not-found sahifasiga yo'naltiradi (layout saqlanadi). */
export default function CatchAllNotFound() {
  notFound();
}
