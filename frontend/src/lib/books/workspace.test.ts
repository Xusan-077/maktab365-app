import { describe, expect, it } from "vitest";
import {
  clampPanelWidth,
  DEFAULT_WORKSPACE,
  MAX_PANEL_WIDTH,
  MIN_PANEL_WIDTH,
  nextSheetState,
  pushRecentColor,
  RECENT_COLORS_LIMIT,
  sanitizeWorkspace,
  snapSheet,
} from "./workspace";

describe("clampPanelWidth", () => {
  it("min va max oralig'ida qoladi", () => {
    expect(clampPanelWidth(10)).toBe(MIN_PANEL_WIDTH);
    expect(clampPanelWidth(5000)).toBe(MAX_PANEL_WIDTH);
    expect(clampPanelWidth(400)).toBe(400);
  });

  it("torroq konteynerda kitob uchun joy qoldiradi (60%)", () => {
    expect(clampPanelWidth(560, 800)).toBe(480);
    expect(clampPanelWidth(560, 300)).toBe(MIN_PANEL_WIDTH);
  });

  it("NaN standartga tushadi", () => {
    expect(clampPanelWidth(Number.NaN)).toBe(DEFAULT_WORKSPACE.panelWidth);
  });
});

describe("pushRecentColor", () => {
  it("yangisi boshiga, takror yo'q, chegaralangan", () => {
    let colors: string[] = [];
    for (const color of ["#111111", "#222222", "#333333", "#444444", "#555555", "#666666"]) {
      colors = pushRecentColor(colors, color);
    }
    expect(colors).toHaveLength(RECENT_COLORS_LIMIT);
    expect(colors[0]).toBe("#666666");
    expect(pushRecentColor(colors, "#444444")[0]).toBe("#444444");
    expect(new Set(pushRecentColor(colors, "#444444")).size).toBe(RECENT_COLORS_LIMIT);
  });
});

describe("sanitizeWorkspace", () => {
  it("buzilgan qiymat standartga tushadi", () => {
    expect(sanitizeWorkspace(null)).toEqual(DEFAULT_WORKSPACE);
    expect(sanitizeWorkspace("x")).toEqual(DEFAULT_WORKSPACE);
    expect(
      sanitizeWorkspace({ panelWidth: "keng", penColor: "red", penWidth: 9, recentColors: ["x"] }),
    ).toEqual(DEFAULT_WORKSPACE);
  });

  it("to'g'ri qiymatlar saqlanadi, kenglik chegaralanadi", () => {
    const value = sanitizeWorkspace({
      notesOpen: true,
      panelWidth: 9000,
      penColor: "#e5484d",
      recentColors: ["#e5484d", "ink", "yomon"],
    });
    expect(value.notesOpen).toBe(true);
    expect(value.panelWidth).toBe(MAX_PANEL_WIDTH);
    expect(value.penColor).toBe("#e5484d");
    expect(value.recentColors).toEqual(["#e5484d", "ink"]);
  });
});

describe("mobil sheet", () => {
  it("tugma ketma-ket yopiq → yarim → to'liq → yopiq", () => {
    expect(nextSheetState("closed")).toBe("half");
    expect(nextSheetState("half")).toBe("full");
    expect(nextSheetState("full")).toBe("closed");
  });

  it("sekin sudralganda eng yaqin holatga", () => {
    expect(snapSheet(0.1, 0)).toBe("closed");
    expect(snapSheet(0.45, 0)).toBe("half");
    expect(snapSheet(0.85, 0)).toBe("full");
  });

  it("tez surish yo'nalish bo'yicha", () => {
    expect(snapSheet(0.86, 1)).toBe("half");
    expect(snapSheet(0.42, 1)).toBe("closed");
    expect(snapSheet(0.42, -1)).toBe("full");
    expect(snapSheet(0.2, -1)).toBe("half");
  });
});
