import type { SupportInput, SupportKind } from "@/types/support";

export type SupportFormValues = {
  kind: SupportKind;
  email: string;
  message: string;
  /** Honeypot. */
  website: string;
};

export type SupportContext = {
  topic?: string;
  pageUrl?: string;
  pdfBook?: string;
  page?: number;
};

const PAGE_URL_MAX = 500;

/**
 * Forma qiymatlaridan API so'rovini yasaydi. Honeypot to'ldirilgan bo'lsa (bot) `null`:
 * so'rov yuborilmaydi, UI esa muvaffaqiyat ko'rsatadi (botga signal bermaymiz).
 */
export function buildSupportInput(
  values: SupportFormValues,
  context: SupportContext = {},
): SupportInput | null {
  if (values.website.trim() !== "") return null;
  const email = values.email.trim();
  return {
    kind: values.kind,
    message: values.message.trim(),
    ...(email && { email }),
    ...(context.topic && { topic: context.topic }),
    ...(context.pageUrl && { pageUrl: context.pageUrl.slice(0, PAGE_URL_MAX) }),
    ...(context.pdfBook && { pdfBook: context.pdfBook }),
    ...(context.page && context.page > 0 && { page: context.page }),
  };
}
