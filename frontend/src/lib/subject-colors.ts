import { GROUP_URL, SUBJECT_GROUPS, type SubjectGroup } from "@/lib/pdf/grade-groups";

/**
 * Fan yo'nalishi (backend `SubjectGroup`) → rang. Ranglarning o'zi `globals.css` dagi
 * `--group-*` tokenlarida (light/dark), shu yerda faqat slug → token xaritasi. Tailwind
 * klasslari statik yozilgan (dinamik qurilsa JIT ko'rmaydi).
 */
export interface GroupColor {
  /** `text-group-*` — matn/ikonka. */
  text: string;
  /** `bg-group-*-soft` — och tint fon. */
  soft: string;
  /** `bg-group-*` — to'liq rang fon (muqova zaxirasi, nuqta). */
  solid: string;
  /** `border-group-*` */
  border: string;
  /** CSS o'zgaruvchi nomlari: inline `style` kerak bo'lganda (masalan gradient). */
  vars: { color: string; soft: string };
}

const COLORS: Record<SubjectGroup, GroupColor> = {
  exact: {
    text: "text-group-exact",
    soft: "bg-group-exact-soft",
    solid: "bg-group-exact",
    border: "border-group-exact",
    vars: { color: "var(--group-exact)", soft: "var(--group-exact-soft)" },
  },
  natural: {
    text: "text-group-natural",
    soft: "bg-group-natural-soft",
    solid: "bg-group-natural",
    border: "border-group-natural",
    vars: { color: "var(--group-natural)", soft: "var(--group-natural-soft)" },
  },
  language: {
    text: "text-group-language",
    soft: "bg-group-language-soft",
    solid: "bg-group-language",
    border: "border-group-language",
    vars: { color: "var(--group-language)", soft: "var(--group-language-soft)" },
  },
  social: {
    text: "text-group-social",
    soft: "bg-group-social-soft",
    solid: "bg-group-social",
    border: "border-group-social",
    vars: { color: "var(--group-social)", soft: "var(--group-social-soft)" },
  },
  arts: {
    text: "text-group-arts",
    soft: "bg-group-arts-soft",
    solid: "bg-group-arts",
    border: "border-group-arts",
    vars: { color: "var(--group-arts)", soft: "var(--group-arts-soft)" },
  },
};

const URL_TO_GROUP = Object.fromEntries(
  SUBJECT_GROUPS.map((group) => [GROUP_URL[group], group]),
) as Record<string, SubjectGroup>;

/** Backend qiymati (`exact`) yoki URL slug'i (`aniq`) → guruh; noma'lum bo'lsa `undefined`. */
export function toSubjectGroup(slug: string | null | undefined): SubjectGroup | undefined {
  if (!slug) return undefined;
  if ((SUBJECT_GROUPS as readonly string[]).includes(slug)) return slug as SubjectGroup;
  return URL_TO_GROUP[slug];
}

/** Guruh rangi; noma'lum guruh (yangi backend qiymati) brend ko'ki (`exact`) bilan almashadi. */
export function groupColor(slug: string | null | undefined): GroupColor {
  return COLORS[toSubjectGroup(slug) ?? "exact"];
}
