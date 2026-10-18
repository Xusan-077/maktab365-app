import type { LocalizedText } from "@/types/i18n";

/** Mock matnlarini qisqa yozish uchun: ru/en berilmasa maydon umuman qo'yilmaydi. */
export function lt(uz: string, ru?: string, en?: string): LocalizedText {
  return { uz, ...(ru !== undefined && { ru }), ...(en !== undefined && { en }) };
}
