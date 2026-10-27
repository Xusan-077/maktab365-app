import { describe, expect, it } from "vitest";
import {
  answerIndex,
  IMPORT_MAX,
  parseCsv,
  parseQuestionImport,
  serverRowErrors,
} from "./question-import";

describe("answerIndex", () => {
  it.each([
    ["A", 0],
    ["b", 1],
    ["C)", 2],
    [" d ", 3],
    ["1", 0],
    [4, 3],
    ["E", null],
    ["0", null],
    ["", null],
    [undefined, null],
  ])("%s → %s", (raw, expected) => {
    expect(answerIndex(raw)).toBe(expected);
  });
});

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, delimiters and newlines inside fields", () => {
    expect(parseCsv('a,"b, c","d ""e""",\r\n"x\ny",z', ",")).toEqual([
      ["a", "b, c", 'd "e"', ""],
      ["x\ny", "z"],
    ]);
  });
});

describe("parseQuestionImport — CSV", () => {
  it("parses rows with header, semicolons and difficulty", () => {
    const csv = [
      "savol;A;B;C;D;to'g'ri_javob;qiyinlik",
      "2+2?;3;4;5;6;B;oson",
      '"Poytaxt; qaysi?";Toshkent;Samarqand;Buxoro;Xiva;1',
    ].join("\n");
    const result = parseQuestionImport(csv);
    expect(result).toMatchObject({ format: "csv", error: null });
    expect(result.rows).toHaveLength(2);
    const [first, second] = result.rows;
    expect(first.line).toBe(2);
    expect(first.item).toEqual({
      text: { uz: "2+2?" },
      difficulty: "easy",
      is_active: true,
      options: [
        { text: { uz: "3" }, is_correct: false },
        { text: { uz: "4" }, is_correct: true },
        { text: { uz: "5" }, is_correct: false },
        { text: { uz: "6" }, is_correct: false },
      ],
    });
    expect(second.preview).toBe("Poytaxt; qaysi?");
    expect(second.item?.difficulty).toBe("medium");
    expect(second.item?.options[0].is_correct).toBe(true);
  });

  it("works without a header and skips blank lines", () => {
    const result = parseQuestionImport("Q;a;b;c;d;D\n\n");
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].item?.options[3].is_correct).toBe(true);
  });

  it("reports row errors without dropping valid rows", () => {
    const csv = [
      "Q1,a,b,c,d,X",
      ",a,b,c,d,A",
      "Q3,a,,c,d,A",
      "Q4,a,b,c,A",
      "Q5,a,b,c,d,A,juda",
    ].join("\n");
    const errors = parseQuestionImport(csv).rows.map((row) => row.errors);
    expect(errors).toEqual([
      ["answerInvalid"],
      ["questionRequired"],
      ["optionRequired"],
      ["optionsCount"],
      ["difficultyInvalid"],
    ]);
  });

  it("flags too long text", () => {
    const row = parseQuestionImport(`${"x".repeat(1001)},a,b,c,d,A`).rows[0];
    expect(row.errors).toEqual(["tooLong"]);
    expect(row.item).toBeNull();
  });

  it("limits row count", () => {
    const csv = Array.from({ length: IMPORT_MAX + 1 }, (_, i) => `Q${i},a,b,c,d,A`).join("\n");
    expect(parseQuestionImport(csv).error).toBe("tooMany");
  });

  it("empty input", () => {
    expect(parseQuestionImport("  \n").error).toBe("empty");
  });
});

describe("parseQuestionImport — JSON", () => {
  it("accepts the short shape with localized text", () => {
    const json = JSON.stringify([
      { savol: { uz: "Savol", ru: "Вопрос" }, A: "a", B: "b", C: "c", D: "d", togri_javob: "C" },
      { question: "Q", options: ["1", "2", "3", "4"], answer: 4, difficulty: "hard" },
    ]);
    const [first, second] = parseQuestionImport(json).rows;
    expect(first.item?.text).toEqual({ uz: "Savol", ru: "Вопрос" });
    expect(first.item?.options.map((o) => o.is_correct)).toEqual([false, false, true, false]);
    expect(second.item?.difficulty).toBe("hard");
    expect(second.item?.options[3].is_correct).toBe(true);
  });

  it("accepts the API shape and requires exactly one correct option", () => {
    const option = (uz: string, is_correct = false) => ({ text: { uz }, is_correct });
    const json = JSON.stringify({
      questions: [
        { text: { uz: "Q" }, options: [option("a"), option("b", true), option("c"), option("d")] },
        {
          text: { uz: "Q2" },
          options: [option("a", true), option("b", true), option("c"), option("d")],
        },
      ],
    });
    const [ok, bad] = parseQuestionImport(json).rows;
    expect(ok.item?.options[1].is_correct).toBe(true);
    expect(bad.errors).toEqual(["answerInvalid"]);
  });

  it("invalid JSON and non-object entries", () => {
    expect(parseQuestionImport("[1,").error).toBe("invalidJson");
    expect(parseQuestionImport('{"a":1}').error).toBe("invalidJson");
    expect(parseQuestionImport("[1]").rows[0].errors).toEqual(["invalidRow"]);
  });
});

describe("serverRowErrors", () => {
  it("maps server indexes to the sent rows' lines", () => {
    const sent = parseQuestionImport("Q,a,b,c,d,A\nQ2,a,b,c,d,A").rows;
    expect([...serverRowErrors({ "1": { options: ["options_count"] } }, sent)]).toEqual([2]);
    expect(serverRowErrors(null, sent).size).toBe(0);
  });
});
