/**
 * Generativ muqova ranglari: fan guruhi → ohang (`data-tone`). Ranglarning o'zi `globals.css`
 * dagi `--cover-*` tokenlarida; bu yerda faqat fan → guruh xaritasi va noma'lum fanlar uchun
 * barqaror (nom xeshiga ko'ra) tanlov.
 */
export type CoverGroup = "exact" | "nature" | "social" | "language";

/** Fan slug'i → guruh (`backend/.../seed_subjects.py` ro'yxati bilan mos). */
export const SUBJECT_GROUPS: Record<string, CoverGroup> = {
  matematika: "exact",
  algebra: "exact",
  geometriya: "exact",
  informatika: "exact",
  fizika: "exact",
  chizmachilik: "exact",
  kimyo: "nature",
  biologiya: "nature",
  geografiya: "nature",
  "tabiiy-fan": "nature",
  tarix: "social",
  texnologiya: "social",
  "jismoniy-tarbiya": "social",
  musiqa: "social",
  "tasviriy-san-at": "social",
  "ona-tili": "language",
  adabiyot: "language",
  "ingliz-tili": "language",
  "rus-tili": "language",
};

/** Noma'lum fanlar uchun zaxira ohanglar soni (`--cover-fallback-0…N-1`). */
export const FALLBACK_TONES = 6;

/** FNV-1a: qisqa matn uchun tez, barqaror 32-bit xesh. */
export function hashString(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** `data-tone` qiymati: ma'lum fan uchun guruh, aks holda nom xeshiga ko'ra `fallback-N`. */
export function coverTone(subject: string): string {
  const key = subject.trim().toLowerCase();
  const group = SUBJECT_GROUPS[key];
  if (group) return group;
  return `fallback-${hashString(key) % FALLBACK_TONES}`;
}
