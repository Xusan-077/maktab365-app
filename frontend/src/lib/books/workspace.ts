import {
  DEFAULT_HIGHLIGHT_COLOR,
  DEFAULT_PEN_COLOR,
  DEFAULT_TEXT_COLOR,
  HIGHLIGHT_COLORS,
  PEN_COLORS,
  PEN_WIDTHS,
  TEXT_SIZES,
} from "./annotations";

/** Ish maydoni (yon daftar + asboblar) sozlamalari: qurilma bo'yicha, localStorage. */

export const MIN_PANEL_WIDTH = 280;
export const MAX_PANEL_WIDTH = 560;
export const DEFAULT_PANEL_WIDTH = 360;
export const PANEL_KEY_STEP = 24;
export const RECENT_COLORS_LIMIT = 5;

export const SHEET_STATES = ["closed", "half", "full"] as const;
export type SheetState = (typeof SHEET_STATES)[number];

export interface WorkspacePrefs {
  notesOpen: boolean;
  panelWidth: number;
  penColor: string;
  penWidth: number;
  highlightColor: string;
  textColor: string;
  textSize: number;
  recentColors: string[];
}

export const DEFAULT_WORKSPACE: WorkspacePrefs = {
  notesOpen: false,
  panelWidth: DEFAULT_PANEL_WIDTH,
  penColor: DEFAULT_PEN_COLOR,
  penWidth: PEN_WIDTHS[1],
  highlightColor: DEFAULT_HIGHLIGHT_COLOR,
  textColor: DEFAULT_TEXT_COLOR,
  textSize: TEXT_SIZES[1],
  recentColors: [],
};

/** Panel kengligi chegaralanadi; konteyner torroq bo'lsa (`available`) kitob siqilib ketmasin. */
export function clampPanelWidth(width: number, available?: number): number {
  const ceiling =
    available === undefined ? MAX_PANEL_WIDTH : Math.min(MAX_PANEL_WIDTH, available * 0.6);
  const value = Number.isFinite(width) ? width : DEFAULT_PANEL_WIDTH;
  return Math.round(Math.min(Math.max(value, MIN_PANEL_WIDTH), Math.max(ceiling, MIN_PANEL_WIDTH)));
}

/** Oxirgi ishlatilgan ranglar: yangisi boshiga, takror yo'q, chegaralangan. */
export function pushRecentColor(colors: readonly string[], color: string): string[] {
  return [color, ...colors.filter((existing) => existing !== color)].slice(0, RECENT_COLORS_LIMIT);
}

const isColor = (value: unknown): value is string =>
  typeof value === "string" && /^(#[0-9a-fA-F]{6}|ink)$/.test(value);
const nearest = (value: unknown, allowed: readonly number[], fallback: number): number =>
  typeof value === "number" && allowed.includes(value) ? value : fallback;

/** localStorage'dagi qiymatni xavfsiz o'qish (buzilgan/eskirgan bo'lsa standart). */
export function sanitizeWorkspace(value: unknown): WorkspacePrefs {
  const raw = (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;
  const recent = Array.isArray(raw.recentColors) ? raw.recentColors.filter(isColor) : [];
  return {
    notesOpen: raw.notesOpen === true,
    panelWidth: clampPanelWidth(
      typeof raw.panelWidth === "number" ? raw.panelWidth : DEFAULT_PANEL_WIDTH,
    ),
    penColor:
      isColor(raw.penColor) && (PEN_COLORS as readonly string[]).includes(raw.penColor)
        ? raw.penColor
        : DEFAULT_WORKSPACE.penColor,
    penWidth: nearest(raw.penWidth, PEN_WIDTHS, DEFAULT_WORKSPACE.penWidth),
    highlightColor:
      isColor(raw.highlightColor) &&
      (HIGHLIGHT_COLORS as readonly string[]).includes(raw.highlightColor)
        ? raw.highlightColor
        : DEFAULT_WORKSPACE.highlightColor,
    textColor: isColor(raw.textColor) ? raw.textColor : DEFAULT_WORKSPACE.textColor,
    textSize: nearest(raw.textSize, TEXT_SIZES, DEFAULT_WORKSPACE.textSize),
    recentColors: recent.slice(0, RECENT_COLORS_LIMIT),
  };
}

/** Mobil sheet holatlari: tugma bosilganda yopiq → yarim → to'liq → yopiq. */
export function nextSheetState(state: SheetState): SheetState {
  return state === "closed" ? "half" : state === "half" ? "full" : "closed";
}

/**
 * Sudralgan sheet qaysi holatga o'tadi: balandlik ulushi (0..1) va tezlik (px/ms, pastga musbat).
 * Tez surish yo'nalish bo'yicha, sekin — eng yaqin holatga.
 */
export function snapSheet(fraction: number, velocity: number): SheetState {
  if (velocity > 0.6) return fraction > 0.55 ? "half" : "closed";
  if (velocity < -0.6) return fraction < 0.25 ? "half" : "full";
  if (fraction < 0.22) return "closed";
  return fraction < 0.68 ? "half" : "full";
}

/** Sheet balandligi (ekran balandligiga ulush). */
export const SHEET_FRACTION: Record<SheetState, number> = { closed: 0, half: 0.42, full: 0.86 };
