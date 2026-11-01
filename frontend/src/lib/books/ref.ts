/** `/kutubxona/<ref>`: slug yoki (eski havolalar uchun) kitob UUID'si. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type BookRef = { kind: "id"; value: string } | { kind: "slug"; value: string };

export function parseBookRef(ref: string): BookRef | null {
  if (UUID.test(ref)) return { kind: "id", value: ref.toLowerCase() };
  if (ref.length <= 120 && SLUG.test(ref)) return { kind: "slug", value: ref };
  return null;
}

/** Prerender uchun namuna yo'l: slug alifbosiga kirmaydi, shuning uchun backend'ga so'rov ketmaydi (404). */
export const SAMPLE_REF = "_namuna";
