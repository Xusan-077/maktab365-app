import { describe, expect, it } from "vitest";
import {
  availableCounts,
  defaultTeamCount,
  estimateMinutes,
  fitQuestionCount,
  isGameId,
} from "./config";
import {
  allOpened,
  boxQuestionCount,
  makeBoxes,
  openBox,
  specialCount,
  specialPoints,
} from "./box";
import { gamesHref, parseGameFilters } from "./filters";
import { consumeGuest, guestAllowance, monthKey, parseGuestRecord } from "./guest-allowance";
import {
  pullRope,
  ropeDots,
  ropeFinalWinner,
  ropePercent,
  ropeQuestionIndex,
  ropeWinner,
  ROPE_LIMIT,
} from "./rope";
import { applyAnswer, applyBonus, nextTurn, rankTeams, winners, type TeamResult } from "./scoring";
import { sectorAt, sectorPoints, spinRotation, WHEEL_SECTORS } from "./wheel";

const team = (name: string, score = 0, correct = 0, total = 0): TeamResult => ({
  name,
  score,
  correct,
  total,
});

describe("scoring", () => {
  it("gives 1 point per correct answer (more on a ×2 sector) and counts every answer", () => {
    const teams = [team("A"), team("B")];
    const next = applyAnswer(teams, 1, true);
    expect(next[0]).toEqual(team("A"));
    expect(next[1]).toEqual(team("B", 1, 1, 1));
    expect(applyAnswer(next, 1, false)[1]).toEqual(team("B", 1, 1, 2));
    expect(applyAnswer(next, 1, true, 2)[1]).toEqual(team("B", 3, 2, 2));
    expect(teams[1]).toEqual(team("B"));
  });

  it("applies bonuses without counting answers and never goes below zero", () => {
    expect(applyBonus([team("A", 1, 1, 1)], 0, 2)[0]).toEqual(team("A", 3, 1, 1));
    expect(applyBonus([team("A", 0)], 0, -1)[0].score).toBe(0);
    expect(applyBonus([team("A", 3)], 0, -1)[0].score).toBe(2);
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

describe("wheel sectors", () => {
  it("has 6 question sectors, one ×2 and one bonus", () => {
    expect(WHEEL_SECTORS).toHaveLength(8);
    expect(WHEEL_SECTORS.filter((sector) => sector.kind === "question")).toHaveLength(6);
    expect(WHEEL_SECTORS.map(sectorPoints)).toEqual([1, 1, 2, 1, 1, 2, 1, 1]);
  });

  it("lands every spin on the sector shown under the pointer", () => {
    let rotation = 0;
    for (let target = 0; target < WHEEL_SECTORS.length; target++) {
      rotation = spinRotation(rotation, target, WHEEL_SECTORS.length, 5, 0.2);
      expect(WHEEL_SECTORS[sectorAt(rotation, WHEEL_SECTORS.length)]).toBe(WHEEL_SECTORS[target]);
    }
  });
});

describe("box", () => {
  const seeded = (seed: number) => () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  it("adds one bonus and one bomb per 16 boxes", () => {
    expect([8, 12, 16, 24].map(specialCount)).toEqual([1, 1, 1, 2]);
    expect(boxQuestionCount(16)).toBe(14);
    for (const count of [8, 12, 16, 24]) {
      const boxes = makeBoxes(count, seeded(count));
      expect(boxes).toHaveLength(count);
      expect(boxes.filter((box) => box.kind === "bonus")).toHaveLength(specialCount(count));
      expect(boxes.filter((box) => box.kind === "bomb")).toHaveLength(specialCount(count));
      // Savolli qutilar savollarga ketma-ket bog'langan.
      expect(boxes.filter((box) => box.kind === "question").map((box) => box.question)).toEqual(
        Array.from({ length: boxQuestionCount(count) }, (_, index) => index),
      );
    }
  });

  it("places specials randomly", () => {
    const layouts = new Set(
      [1, 2, 3, 4, 5].map((seed) =>
        makeBoxes(16, seeded(seed))
          .map((box) => box.kind[0])
          .join(""),
      ),
    );
    expect(layouts.size).toBeGreaterThan(1);
  });

  it("opens each box once and finishes when all are open", () => {
    let boxes = makeBoxes(8, seeded(7));
    expect(allOpened(boxes)).toBe(false);
    boxes = openBox(boxes, 0, "correct");
    expect(openBox(boxes, 0, "wrong")[0].result).toBe("correct");
    for (let index = 1; index < boxes.length; index++) boxes = openBox(boxes, index, "wrong");
    expect(allOpened(boxes)).toBe(true);
    expect([specialPoints("bonus"), specialPoints("bomb"), specialPoints("question")]).toEqual([
      2, -1, 0,
    ]);
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

  it("shows 11 position dots", () => {
    expect(ropeDots()).toEqual([-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5]);
  });

  it("splits questions between the teams and cycles each team's own", () => {
    expect([0, 1, 2, 3].map((cursor) => ropeQuestionIndex(0, cursor, 8))).toEqual([0, 2, 4, 6]);
    expect([0, 1, 2, 3, 4].map((cursor) => ropeQuestionIndex(1, cursor, 8))).toEqual([
      1, 3, 5, 7, 1,
    ]);
    expect(ropeQuestionIndex(0, 4, 9)).toBe(8);
    expect(ropeQuestionIndex(1, 4, 9)).toBe(1);
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
