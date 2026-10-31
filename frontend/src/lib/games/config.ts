/**
 * Interaktiv o'yinlar: turlari, jamoalar va savollar soni. O'yin id'si marshrutda ham, backend
 * `game_type` da ham bir xil (`/games/<mavzu>/sirli-quti`).
 */
export const GAME_IDS = ["sirli-quti", "omad-charhi", "arqon-tortish"] as const;
export type GameId = (typeof GAME_IDS)[number];

export const isGameId = (value: unknown): value is GameId =>
  typeof value === "string" && (GAME_IDS as readonly string[]).includes(value);

/** i18n kaliti (`games.list.<key>`) va rang tokeni (`--color-game-<key>-*`). */
export const GAME_KEYS: Record<GameId, "box" | "wheel" | "rope"> = {
  "sirli-quti": "box",
  "omad-charhi": "wheel",
  "arqon-tortish": "rope",
};

export const TEAM_COUNTS = [1, 2, 3] as const;
export type TeamCount = (typeof TEAM_COUNTS)[number];

/** O'yinda ruxsat etilgan jamoalar soni: arqon tortishda faqat 2. */
export const GAME_TEAM_COUNTS: Record<GameId, readonly TeamCount[]> = {
  "sirli-quti": [1, 2, 3],
  "omad-charhi": [1, 2, 3],
  "arqon-tortish": [2],
};

export const defaultTeamCount = (game: GameId): TeamCount =>
  GAME_TEAM_COUNTS[game].includes(2) ? 2 : GAME_TEAM_COUNTS[game][0];

/** Jamoa ranglari tartibda: ko'k, qizil, yashil (`--color-team-*`). */
export const TEAM_COLORS = ["blue", "red", "green"] as const;
export type TeamColor = (typeof TEAM_COLORS)[number];

export const QUESTION_COUNTS = [8, 12, 16, 24] as const;
export const DEFAULT_QUESTION_COUNT = 16;
export const SECONDS_PER_QUESTION = 30;
/** Savoldan tashqari vaqt (o'qish, javobni ko'rsatish, navbat almashishi) — taxminiy. */
const SECONDS_OVERHEAD = 10;

/** "~11 daqiqa": savollar soni bo'yicha o'yin davomiyligi (butun daqiqa, kamida 1). */
export const estimateMinutes = (questionCount: number) =>
  Math.max(1, Math.round((questionCount * (SECONDS_PER_QUESTION + SECONDS_OVERHEAD)) / 60));

/** Mavzudagi savollardan ko'p bo'lgan variantlar tanlab bo'lmaydi. */
export const availableCounts = (questionCount: number) =>
  QUESTION_COUNTS.filter((count) => count <= questionCount);

/** Tanlangan son mavzuga sig'masa — eng kattasi sig'adigani (standart 16). */
export const fitQuestionCount = (wanted: number, questionCount: number) => {
  const available = availableCounts(questionCount);
  if (available.includes(wanted as (typeof QUESTION_COUNTS)[number])) return wanted;
  return available.at(-1) ?? QUESTION_COUNTS[0];
};
