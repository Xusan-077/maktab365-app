import { ROUTES } from "@/lib/utils/routes";

/** `/games` filtrlari URL'da: `?q=&grade=&subject=`. */
export interface GameFilters {
  q?: string;
  grade?: number;
  subject?: string;
}

export const GRADES = Array.from({ length: 11 }, (_, index) => index + 1);
export const QUERY_MAX_LENGTH = 100;

type Params = URLSearchParams | Record<string, string | string[] | undefined>;

const first = (params: Params, key: string): string | undefined => {
  const value = params instanceof URLSearchParams ? params.get(key) : params[key];
  return (Array.isArray(value) ? value[0] : value) ?? undefined;
};

export function parseGameFilters(params: Params): GameFilters {
  const q = first(params, "q")?.trim().slice(0, QUERY_MAX_LENGTH) || undefined;
  const gradeRaw = Number(first(params, "grade"));
  const grade = GRADES.includes(gradeRaw) ? gradeRaw : undefined;
  const subjectRaw = first(params, "subject")?.trim();
  const subject = subjectRaw && /^[a-z0-9-]{1,80}$/.test(subjectRaw) ? subjectRaw : undefined;
  return { q, grade, subject };
}

/** Filtrlar → `/games?q=…&grade=…&subject=…` (bo'shlari tashlanadi; tartib barqaror). */
export function gamesHref(filters: GameFilters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.grade) params.set("grade", String(filters.grade));
  if (filters.subject) params.set("subject", filters.subject);
  const query = params.toString();
  return query ? `${ROUTES.games}?${query}` : ROUTES.games;
}
