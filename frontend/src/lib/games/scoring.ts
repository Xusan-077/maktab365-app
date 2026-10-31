/** Jamoaning joriy natijasi (backend `TeamResult` bilan bir xil maydonlar). */
export interface TeamResult {
  name: string;
  score: number;
  correct: number;
  total: number;
}

/** To'g'ri javob uchun ball (charxning "×2" sektorida — ikki baravar). */
export const POINTS_CORRECT = 1;

/** Bir jamoa javobini hisobga oladi (o'zgarmas: yangi massiv); xato javob ball bermaydi. */
export function applyAnswer(
  teams: TeamResult[],
  teamIndex: number,
  correct: boolean,
  points = POINTS_CORRECT,
): TeamResult[] {
  return teams.map((team, index) =>
    index === teamIndex
      ? {
          ...team,
          score: team.score + (correct ? points : 0),
          correct: team.correct + (correct ? 1 : 0),
          total: team.total + 1,
        }
      : team,
  );
}

/** Savolsiz ball (Bonus +2, Bomba −1): javoblar soniga kirmaydi, ball 0 dan pastga tushmaydi. */
export function applyBonus(teams: TeamResult[], teamIndex: number, delta: number): TeamResult[] {
  return teams.map((team, index) =>
    index === teamIndex ? { ...team, score: Math.max(0, team.score + delta) } : team,
  );
}

/** Navbat jamoalar orasida aylanadi: 0 → 1 → 2 → 0. */
export const nextTurn = (turn: number, teamCount: number) =>
  teamCount > 0 ? (turn + 1) % teamCount : 0;

export interface RankedTeam extends TeamResult {
  index: number;
  /** 1 — g'olib; teng ball bir xil o'rin oladi (1, 1, 3). */
  place: number;
}

/** Natija jadvali: ball bo'yicha, teng bo'lsa to'g'ri javoblar bo'yicha; tenglar bir o'rinda. */
export function rankTeams(teams: TeamResult[]): RankedTeam[] {
  const sorted = teams
    .map((team, index) => ({ ...team, index }))
    .sort((a, b) => b.score - a.score || b.correct - a.correct || a.index - b.index);
  return sorted.map((team, position) => {
    const first = sorted.findIndex(
      (other) => other.score === team.score && other.correct === team.correct,
    );
    return { ...team, place: (first === -1 ? position : first) + 1 };
  });
}

/** G'oliblar (bir nechta bo'lishi mumkin); hech kim ball olmagan bo'lsa bo'sh. */
export function winners(teams: TeamResult[]): number[] {
  const ranked = rankTeams(teams);
  if (!ranked.length || ranked[0].score === 0) return [];
  return ranked.filter((team) => team.place === 1).map((team) => team.index);
}
