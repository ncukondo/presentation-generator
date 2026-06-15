/**
 * Theme system — palettes + fonts resolved from the `theme:` block in slides.yaml.
 *
 * Goal: make the color palette swappable per project ("内容に合った配色を準備")
 * without touching any pages/*.ts. `lib/theme.ts` consumes `resolveTheme()` /
 * `resolveFonts()` and re-exports `C` / `FONT*` with the SAME field shape, so
 * downstream layout code is unaffected.
 *
 * Two ways to set a theme (see slides.yaml `theme:`):
 *   1. preset — pick a complete, hand-tuned palette by name (blue/warm/forest/slate)
 *   2. seed   — give just `primary` (+ optional accent); the rest is derived
 * Field-level overrides (any Palette key) can be layered on top of either.
 */
import {
  lighten, mixWhite, rotateHue, ensureContrastOnWhite, normalizeHex, isHex,
} from "./color";

// ── Palette shape (mirrors lib/theme.ts `C`) ─────────────
export interface Palette {
  primary: string;
  primaryLight: string;
  accent: string;
  accentLight: string;

  white: string;
  offWhite: string;
  warmBg: string;
  lightGray: string;
  midGray: string;
  darkGray: string;
  text: string;
  black: string;

  step1: string; step2: string; step3: string; step4: string;
  step5: string; step6: string; step7: string;

  cardBlue: string;
  cardGreen: string;
  cardOrange: string;
  cardPurple: string;
  cardCyan: string;

  chartBlue: string;
  chartGreen: string;
  chartOrange: string;
}

// Neutral, subject-independent colors shared by every palette.
// (text/grays stay constant; only the hue-bearing colors change per theme.)
const NEUTRALS = {
  white: "FFFFFF",
  offWhite: "FAFBFE",
  lightGray: "ECEFF1",
  midGray: "B0BEC5",
  darkGray: "546E7A",
  text: "37474F",
  black: "000000",
} as const;

// ── Presets (complete, hand-tuned palettes) ──────────────
export const presets: Record<string, Palette> = {
  // Current default — values copied verbatim from the original theme.ts.
  blue: {
    primary: "1E88E5", primaryLight: "64B5F6",
    accent: "FF9800", accentLight: "FFCC80",
    ...NEUTRALS,
    warmBg: "FFF9F2",
    step1: "1E88E5", step2: "43A047", step3: "AB47BC", step4: "EF6C00",
    step5: "E53935", step6: "0097A7", step7: "546E7A",
    cardBlue: "E3F2FD", cardGreen: "E8F5E9", cardOrange: "FFF3E0",
    cardPurple: "F3E5F5", cardCyan: "E0F7FA",
    chartBlue: "42A5F5", chartGreen: "66BB6A", chartOrange: "FFA726",
  },
  // Warm coral / amber.
  warm: {
    primary: "E5533D", primaryLight: "FF8A65",
    accent: "FFB300", accentLight: "FFE082",
    ...NEUTRALS,
    warmBg: "FFF6F0",
    step1: "E5533D", step2: "43A047", step3: "8E24AA", step4: "EF6C00",
    step5: "C62828", step6: "00897B", step7: "6D4C41",
    cardBlue: "E3F2FD", cardGreen: "E8F5E9", cardOrange: "FFF3E0",
    cardPurple: "F3E5F5", cardCyan: "E0F7FA",
    chartBlue: "42A5F5", chartGreen: "66BB6A", chartOrange: "FFA726",
  },
  // Forest green.
  forest: {
    primary: "2E7D32", primaryLight: "66BB6A",
    accent: "F9A825", accentLight: "FFE082",
    ...NEUTRALS,
    warmBg: "F6FAF4",
    step1: "2E7D32", step2: "1565C0", step3: "6A1B9A", step4: "EF6C00",
    step5: "C62828", step6: "00838F", step7: "4E342E",
    cardBlue: "E3F2FD", cardGreen: "E8F5E9", cardOrange: "FFF3E0",
    cardPurple: "F3E5F5", cardCyan: "E0F7FA",
    chartBlue: "42A5F5", chartGreen: "66BB6A", chartOrange: "FFA726",
  },
  // Monochrome slate + single warm accent.
  slate: {
    primary: "37474F", primaryLight: "78909C",
    accent: "FF7043", accentLight: "FFAB91",
    ...NEUTRALS,
    warmBg: "F7F9FA",
    step1: "37474F", step2: "00695C", step3: "4527A0", step4: "BF360C",
    step5: "AD1457", step6: "00838F", step7: "455A64",
    cardBlue: "ECEFF1", cardGreen: "E8F5E9", cardOrange: "FFF3E0",
    cardPurple: "EDE7F6", cardCyan: "E0F7FA",
    chartBlue: "546E7A", chartGreen: "66BB6A", chartOrange: "FFA726",
  },
};

// Default preset. "slate" (monochrome slate + a single coral accent) is chosen
// as the out-of-box default because it degrades gracefully — a deck that never
// touches `theme:` still looks restrained and professional, which suits
// academic / data-dense talks. Switch to "blue" (or any preset) per project.
export const DEFAULT_PRESET = "slate";

// ── Seed-based derivation ────────────────────────────────
export interface ThemeSeed {
  primary: string;
  accent?: string;
  warmBg?: string;
}

/**
 * Derive a full palette from a primary (+ optional accent).
 * - light variants via `lighten`
 * - pastel card backgrounds via `mixWhite`
 * - 7 step colors by rotating the primary hue, each nudged to ≥3:1 on white
 * - neutrals/text stay fixed
 */
export function derivePalette(seed: ThemeSeed): Palette {
  const primary = normalizeHex(seed.primary);
  const accent = seed.accent ? normalizeHex(seed.accent) : rotateHue(primary, 150);

  // Seven distinguishable categories spaced around the hue wheel from primary.
  const stepOffsets = [0, 51, 103, 154, 206, 257, 309];
  const steps = stepOffsets.map((deg) =>
    ensureContrastOnWhite(deg === 0 ? primary : rotateHue(primary, deg), 3.0),
  );

  const pastel = (deg: number) => mixWhite(rotateHue(primary, deg), 0.88);

  return {
    primary,
    primaryLight: lighten(primary, 0.35),
    accent,
    accentLight: lighten(accent, 0.45),
    ...NEUTRALS,
    warmBg: seed.warmBg ? normalizeHex(seed.warmBg) : mixWhite(primary, 0.96),
    step1: steps[0]!, step2: steps[1]!, step3: steps[2]!, step4: steps[3]!,
    step5: steps[4]!, step6: steps[5]!, step7: steps[6]!,
    cardBlue: pastel(0),
    cardGreen: pastel(103),
    cardOrange: pastel(206),
    cardPurple: pastel(309),
    cardCyan: pastel(154),
    chartBlue: lighten(primary, 0.15),
    chartGreen: lighten(rotateHue(primary, 103), 0.1),
    chartOrange: lighten(accent, 0.1),
  };
}

// ── Resolution from the slides.yaml `theme:` block ───────
export interface ThemeBlock {
  preset?: string;
  primary?: string;
  accent?: string;
  warmBg?: string;
  fonts?: { jp?: string; en?: string };
  // any Palette key may also appear as a field-level override
  [key: string]: unknown;
}

const PALETTE_KEYS: (keyof Palette)[] = [
  "primary", "primaryLight", "accent", "accentLight",
  "white", "offWhite", "warmBg", "lightGray", "midGray", "darkGray", "text", "black",
  "step1", "step2", "step3", "step4", "step5", "step6", "step7",
  "cardBlue", "cardGreen", "cardOrange", "cardPurple", "cardCyan",
  "chartBlue", "chartGreen", "chartOrange",
];

/** Validate a theme block, returning human-readable warnings (never throws). */
export function validateThemeBlock(block: unknown): string[] {
  const warnings: string[] = [];
  if (block == null) return warnings;
  if (typeof block !== "object" || Array.isArray(block)) {
    return [`theme: expected an object, got ${Array.isArray(block) ? "array" : typeof block}`];
  }
  const b = block as ThemeBlock;
  if (b.preset !== undefined && !(b.preset in presets)) {
    warnings.push(`theme.preset "${b.preset}" is unknown (available: ${Object.keys(presets).join(", ")}). Falling back to "${DEFAULT_PRESET}".`);
  }
  for (const key of PALETTE_KEYS) {
    const v = (b as Record<string, unknown>)[key];
    if (v !== undefined && !isHex(v)) {
      warnings.push(`theme.${key} "${String(v)}" is not a valid hex color — ignored.`);
    }
  }
  return warnings;
}

/**
 * Resolve a complete palette from the theme block.
 * Order: preset → seed-derived → default; then field-level hex overrides.
 */
export function resolveTheme(block: ThemeBlock | undefined | null): Palette {
  const b: ThemeBlock = block && typeof block === "object" && !Array.isArray(block) ? block : {};

  let base: Palette;
  if (b.preset && b.preset in presets) {
    base = { ...presets[b.preset]! };
  } else if (b.primary && isHex(b.primary)) {
    base = derivePalette({
      primary: b.primary,
      accent: isHex(b.accent) ? (b.accent as string) : undefined,
      warmBg: isHex(b.warmBg) ? (b.warmBg as string) : undefined,
    });
  } else {
    base = { ...presets[DEFAULT_PRESET]! };
  }

  // Field-level overrides (any valid hex Palette key wins over the base).
  for (const key of PALETTE_KEYS) {
    const v = (b as Record<string, unknown>)[key];
    if (isHex(v)) base[key] = normalizeHex(v as string);
  }
  return base;
}

// ── Fonts ────────────────────────────────────────────────
export interface Fonts { jp: string; en: string; }

const DEFAULT_FONTS: Fonts = { jp: "Meiryo", en: "Arial" };

export function resolveFonts(block: ThemeBlock | undefined | null): Fonts {
  const f = block && typeof block === "object" ? (block as ThemeBlock).fonts : undefined;
  return {
    jp: typeof f?.jp === "string" && f.jp.trim() ? f.jp.trim() : DEFAULT_FONTS.jp,
    en: typeof f?.en === "string" && f.en.trim() ? f.en.trim() : DEFAULT_FONTS.en,
  };
}
