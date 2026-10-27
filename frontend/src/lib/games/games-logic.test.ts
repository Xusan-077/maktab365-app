import { describe, expect, it } from "vitest";
import {
  availableCounts,
  defaultTeamCount,
  estimateMinutes,
  fitQuestionCount,
  isGameId,
} from "./config";
import { gamesHref, parseGameFilters } from "./filters";
import { consumeGuest, guestAllowance, monthKey, parseGuestRecord } from "./guest-allowance";
import { pullRope, ropeFinalWinner, ropePercent, ropeWinner, ROPE_LIMIT } from "./rope";
import {
  answerPoints,
  applyAnswer,
  nextTurn,
  rankTeams,
  winners,
  type TeamResult,
} from "./scoring";
import { sectorAt, spinRotation } from "./wheel";

const team = (name: string, score = 0, correct = 0, total = 0): TeamResult => ({
  name,
  score,
  correct,
  total,
});

describe("scoring", () => {
  it("gives 10 points plus a speed bonus only for correct answers", () => {
    expect(answerPoints(true, 30)).toBe(15);
    expect(answerPoints(true, 11)).toBe(11);
    expect(answerPoints(true, 0)).toBe(10);
    expect(answerPoints(true, 99)).toBe(15);
    expect(answerPoints(false, 30)).toBe(0);
  });

  it("updates only the answering team", () => {
    const teams = [team("A"), team("B")];
    const next = applyAnswer(teams, 1, true, 12);
    expect(next[0]).toEqual(team("A"));
    expect(next[1]).toEqual(team("B", 12, 1, 1));
    expect(applyAnswer(next, 1, false, 30)[1]).toEqual(team("B", 12, 1, 2));
    expect(teams[1]).toEqual(team("B"));
  });

  it("rotates turns", () => {
    expect([0, 1, 2].map((turn) => nextTurn(turn, 3))).toEqual([1, 2, 0]);
    expect(nextTurn(0, 1)).toBe(0);
  });

  it("ranks by score, then correct answers; ties share a place", () => {
    const ranked = rankTeams([team("A", 20, 2), team("B", 30, 3), team("C", 20, 2)]);
    expect(ranked.map((t) => [t.name, t.place])).toEqual([
      ["B", 1],
      ["A", 2],
      ["C", 2],
    ]);
    expect(winners([team("A", 20, 2), team("B", 20, 2)])).toEqual([0, 1]);
    expect(winners([team("A"), team("B")])).toEqual([]);
  });
});

describe("wheel", () => {
  it("reads the sector under the top pointer", () => {
    expect(sectorAt(0, 8)).toBe(0);
    // Charx 45° burilsa tepada oxirgi sektor (soat yo'nalishiga teskari tomondagi).
    expect(sectorAt(45, 8)).toBe(7);
    expect(sectorAt(-45, 8)).toBe(1);
    expect(sectorAt(360 + 10, 6)).toBe(5);
    expect(sectorAt(720, 6)).toBe(0);
  });

  it("spins forward at least the given turns and lands on the target", () => {
    for (const sectors of [3, 6, 8]) {
      for (let target = 0; target < sectors; target++) {
        for (const jitter of [-0.5, 0, 0.3]) {
          const from = 1234.5;
          const to = spinRotation(from, target, sectors, 5, jitter);
          expect(to - from).toBeGreaterThanOrEqual(5 * 360);
          expect(to - from).toBeLessThan(6 * 360);
          expect(sectorAt(to, sectors)).toBe(target);
        }
      }
    }
  });
});

describe("rope", () => {
  it("moves toward the team that answered correctly, clamped to the limit", () => {
    expect(pullRope(0, 0, true)).toBe(-1);
    expect(pullRope(0, 1, true)).toBe(1);
    expect(pullRope(2, 0, false)).toBe(2);
    expect(pullRope(ROPE_LIMIT, 1, true)).toBe(ROPE_LIMIT);
  });

  it("declares a winner when a team reaches its side", () => {
    expect(ropeWinner(-ROPE_LIMIT)).toBe(0);
    expect(ropeWinner(ROPE_LIMIT)).toBe(1);
    expect(ropeWinner(ROPE_LIMIT - 1)).toBeNull();
    let position = 0;
    for (let i = 0; i < ROPE_LIMIT; i++) position = pullRope(position, 1, true);
    expect(ropeWinner(position)).toBe(1);
  });

  it("decides the final winner by side; centre is a draw", () => {
    expect(ropeFinalWinner(-1)).toBe(0);
    expect(ropeFinalWinner(2)).toBe(1);
    expect(ropeFinalWinner(0)).toBeNull();
    expect(ropePercent(0)).toBe(50);
    expect(ropePercent(-ROPE_LIMIT)).toBe(0);
    expect(ropePercent(99)).toBe(100);
  });
});

describe("config", () => {
  it("estimates duration and limits counts by topic size", () => {
    expect(estimateMinutes(16)).toBe(11);
    expect(estimateMinutes(8)).toBe(6);
    expect(availableCounts(13)).toEqual([8, 12]);
    expect(fitQuestionCount(16, 13)).toBe(12);
    expect(fitQuestionCount(16, 40)).toBe(16);
    expect(defaultTeamCount("arqon-tortish")).toBe(2);
    expect(isGameId("omad-charhi")).toBe(true);
    expect(isGameId("natija")).toBe(false);
  });
});

describe("filters", () => {
  it("parses and serializes the URL query", () => {
    expect(parseGameFilters(new URLSearchParams("q=+kasr+&grade=5&subject=matematika"))).toEqual({
      q: "kasr",
      grade: 5,
      subject: "matematika",
    });
    expect(parseGameFilters({ grade: "12", subject: "<x>" })).toEqual({
      q: undefined,
      grade: undefined,
      subject: undefined,
    });
    expect(gamesHref({ grade: 5, q: "kasr" })).toBe("/games?q=kasr&grade=5");
    expect(gamesHref({})).toBe("/games");
  });
});

describe("guest allowance", () => {
  // 2026-10-31 20:00 UTC = 1-noyabr 01:00 Toshkent.
  const lateOctoberUtc = new Date("2026-10-31T20:00:00Z");

  it("uses the Tashkent month", () => {
    expect(monthKey(new Date("2026-10-15T12:00:00Z"))).toBe("2026-10");
    expect(monthKey(lateOctoberUtc)).toBe("2026-11");
  });

  it("counts games within the month and resets next month", () => {
    const now = new Date("2026-10-15T12:00:00Z");
    let record = null as ReturnType<typeof consumeGuest>;
    for (let i = 0; i < 10; i++) record = consumeGuest(record, now);
    expect(guestAllowance(record, now)).toEqual({ limit: 10, used: 10, left: 0 });
    expect(consumeGuest(record, now)).toBeNull();
    expect(guestAllowance(record, lateOctoberUtc).left).toBe(10);
  });

  it("ignores malformed storage", () => {
    expect(parseGuestRecord({ month: "2026-10", used: 3 })).toEqual({ month: "2026-10", used: 3 });
    expect(parseGuestRecord({ month: "oct", used: 3 })).toBeNull();
    expect(parseGuestRecord({ month: "2026-10", used: -1 })).toBeNull();
    expect(parseGuestRecord("x")).toBeNull();
  });
});
