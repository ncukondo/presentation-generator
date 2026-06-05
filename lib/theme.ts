import type PptxGenJS from "pptxgenjs";
import { resolveTheme, resolveFonts, type Palette } from "./themes";
import { getTheme } from "./slides-data";

// ── Colors ──────────────────────────────────────────────
// `C` is resolved from the `theme:` block in slides.yaml (preset name, seed
// color, or field overrides — see lib/themes.ts). The field SHAPE is fixed, so
// pages/*.ts stay agnostic to which theme is active.
//
// Default preset "blue" values (with WCAG notes vs #FFFFFF — white-on-color
// combos meet AA large-text 3:1+):
//   primary 1E88E5 (4.05:1) · accent FF9800 · text 37474F · warmBg FFF9F2
//   step1..7 are all ≥3:1 vs white for large-text AA.
export const C: Palette = resolveTheme(getTheme());

// ── Fonts ───────────────────────────────────────────────
const _fonts = resolveFonts(getTheme());
export const FONT_JP = _fonts.jp;   // 日本語（既定 Meiryo）
export const FONT_EN = _fonts.en;   // 英語（既定 Arial）
export const FONT = FONT_JP;

// ── Font sizes ──────────────────────────────────────────
export const FS = {
  slideTitle: 28,
  sectionTitle: 36,
  sectionSub: 22,
  heading: 24,
  body: 22,
  small: 20,
  micro: 18,
} as const;

// ── Slide dimensions (16:9) ─────────────────────────────
export const SLIDE_W = 13.33;
export const SLIDE_H = 7.5;

// ── Common margins / positions ──────────────────────────
export const MARGIN = {
  left: 0.6,
  right: 0.6,
  top: 0.4,
  titleY: 0.3,
  contentY: 1.3,
} as const;

export const CONTENT_W = SLIDE_W - MARGIN.left - MARGIN.right;

// ── Line styles ─────────────────────────────────────────
export const LINE_THIN: PptxGenJS.ShapeLineProps = { color: C.midGray, width: 0.5 };
