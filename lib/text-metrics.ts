/**
 * Text metrics + Japanese-aware line breaking.
 *
 * Why: PptxGenJS / the rendering backend wrap text with a naive algorithm that
 * produces orphan lines ("…タイト\nル") and breaks at unnatural spots. We can't
 * rely on the renderer to apply Japanese 禁則処理 (kinsoku) or word awareness,
 * so we pre-compute natural, balanced line breaks and insert explicit "\n".
 *
 * Key safety property: `balanceBreak` only re-wraps text that the renderer would
 * already wrap (measureEm > availEm). For single-line text it returns the input
 * unchanged. Wrapping uses a small safety factor so our lines always fit the box
 * width — the renderer never needs to re-wrap our output.
 *
 * Everything here is pure (string/number in, string/number out) and side-effect
 * free, so it is easy to unit-test.
 */

// ── Character classes ────────────────────────────────────
// 行頭禁則: must NOT start a line → cannot break immediately before these.
const LINE_START_FORBIDDEN = new Set(
  "。、，．・：；！？”’）］｝」』】〉》〕｠〙〗ぁぃぅぇぉっゃゅょゎゝゞァィゥェォッャュョヮヵヶ々ー～〜%‰℃°，.,!?:;)]}".split(""),
);
// 行末禁則: must NOT end a line → cannot break immediately after these.
const LINE_END_FORBIDDEN = new Set(
  "（［｛「『【〈《〔｟〘〖“‘([{＄￥＃＠$".split(""),
);

const SENTENCE_END = new Set("。．！？!?".split(""));
const MILD_PUNCT = new Set("、，・：；,".split(""));
const CLOSE_BRACKET = new Set("）］｝」』】〉》〕)]}".split(""));
const OPEN_BRACKET = new Set("（［｛「『【〈《〔([{".split(""));
// Common trailing particles — breaking AFTER one is natural.
const PARTICLES = new Set("はがをにへとでもやかねよのからまで".split(""));

const TOKEN_RE = /[0-9A-Za-z._\-]/;
const NARROW_ASCII = new Set("iIl.,:;'!|ftj()[]{} ".split(""));
const WIDE_ASCII = new Set("mMW@%".split(""));

function isTokenChar(ch: string): boolean {
  return TOKEN_RE.test(ch);
}

function codePoint(ch: string): number {
  return ch.codePointAt(0) ?? 0;
}

function isCJK(ch: string): boolean {
  const cp = codePoint(ch);
  return (
    (cp >= 0x3000 && cp <= 0x30ff) ||  // CJK punct + kana
    (cp >= 0x3400 && cp <= 0x4dbf) ||  // ext A
    (cp >= 0x4e00 && cp <= 0x9fff) ||  // unified
    (cp >= 0xf900 && cp <= 0xfaff) ||  // compat
    (cp >= 0xff00 && cp <= 0xffef)     // fullwidth forms
  );
}

function isHiragana(ch: string): boolean {
  const cp = codePoint(ch);
  return cp >= 0x3040 && cp <= 0x309f;
}
function isKatakana(ch: string): boolean {
  const cp = codePoint(ch);
  return cp >= 0x30a0 && cp <= 0x30ff;
}
function isKana(ch: string): boolean {
  return isHiragana(ch) || isKatakana(ch);
}
function isKanji(ch: string): boolean {
  const cp = codePoint(ch);
  return (cp >= 0x3400 && cp <= 0x4dbf) || (cp >= 0x4e00 && cp <= 0x9fff);
}

// ── Width estimation (in em, i.e. multiples of font size) ─
export function charWidthEm(ch: string): number {
  if (ch === " ") return 0.3;
  const cp = codePoint(ch);
  if (cp < 128) {
    if (NARROW_ASCII.has(ch)) return 0.3;
    if (WIDE_ASCII.has(ch)) return 0.9;
    return 0.5;
  }
  if (cp >= 0xff61 && cp <= 0xff9f) return 0.5; // halfwidth katakana
  if (isCJK(ch)) return 1.0;
  return 1.0;
}

/** Total advance width of a string (ignores explicit "\n"). */
export function measureEm(text: string): number {
  let w = 0;
  for (const ch of text.replace(/\n/g, "")) w += charWidthEm(ch);
  return w;
}

// ── Geometry → available width in em ─────────────────────
export interface WrapOpts {
  marginLeftPt?: number;
  marginRightPt?: number;
  /** safety factor applied when WRAPPING (not when linting) to avoid re-wrap */
  safety?: number;
}

const DEFAULT_SIDE_MARGIN_PT = 3.6; // ≈0.05in if unspecified

export function availEm(widthIn: number, fontSizePt: number, opts: WrapOpts = {}): number {
  const ml = opts.marginLeftPt ?? DEFAULT_SIDE_MARGIN_PT;
  const mr = opts.marginRightPt ?? DEFAULT_SIDE_MARGIN_PT;
  const usablePt = widthIn * 72 - ml - mr;
  return Math.max(1, usablePt / fontSizePt);
}

// ── Break candidates ─────────────────────────────────────
/** Is a line break between cells[i-1] and cells[i] allowed by kinsoku/token rules? */
function isValidBreak(cells: string[], i: number): boolean {
  if (i <= 0 || i >= cells.length) return true;
  const c0 = cells[i - 1]!, c1 = cells[i]!;
  if (LINE_END_FORBIDDEN.has(c0)) return false;
  if (LINE_START_FORBIDDEN.has(c1)) return false;
  if (isTokenChar(c0) && isTokenChar(c1)) return false; // don't split a latin/number token
  return true;
}

/** Naturalness score for a valid break between cells[i-1] and cells[i]; higher = better. */
function breakScore(cells: string[], i: number): number {
  const c0 = cells[i - 1]!, c1 = cells[i]!;
  if (c0 === " " || c1 === " ") return 95;
  if (SENTENCE_END.has(c0)) return 100;
  if (MILD_PUNCT.has(c0)) return 90;
  if (CLOSE_BRACKET.has(c0)) return 85;
  if (OPEN_BRACKET.has(c1)) return 80;
  if (PARTICLES.has(c0)) return 70;
  // script boundary (kanji↔kana, cjk↔latin)
  const cjk0 = isCJK(c0), cjk1 = isCJK(c1);
  if (cjk0 !== cjk1) return 55;
  if (isKanji(c0) && isKana(c1)) return 50;
  if (isKana(c0) && isKanji(c1)) return 48;
  if (isKana(c0) && isKana(c1)) return 22;
  if (isKanji(c0) && isKanji(c1)) return 30;
  return 40;
}

interface WrapResult {
  lines: string[];
  hasForcedBreak: boolean; // a break violated kinsoku/token rules (no valid candidate fit)
  minScore: number;        // lowest naturalness among the (non-forced) breaks used
}

/** Greedy wrap at a target width, preferring valid (kinsoku-respecting) break points. */
function wrapAt(cells: string[], maxEm: number): WrapResult {
  const n = cells.length;
  const prefix = new Array(n + 1).fill(0);
  for (let k = 0; k < n; k++) prefix[k + 1] = prefix[k] + charWidthEm(cells[k]!);
  const width = (a: number, b: number) => prefix[b] - prefix[a];

  const lines: string[] = [];
  let hasForcedBreak = false;
  let minScore = 100;
  let start = 0;

  while (start < n) {
    // furthest b with line width <= maxEm AND (b==n or valid break at b)
    let best = -1;
    let b = start + 1;
    while (b <= n && width(start, b) <= maxEm) {
      if (b === n || isValidBreak(cells, b)) best = b;
      b++;
    }
    let forced = false;
    if (best === -1) {
      // No valid break fits the width. Take as many cells as fit (>=1), forcing a break.
      let fb = start + 1;
      while (fb < n && width(start, fb + 1) <= maxEm) fb++;
      best = Math.max(start + 1, fb);
      forced = true;
    }
    if (best < n) {
      if (forced) hasForcedBreak = true;
      else minScore = Math.min(minScore, breakScore(cells, best));
    }
    lines.push(cells.slice(start, best).join("").replace(/\s+$/, "").replace(/^\s+/, ""));
    start = best;
  }
  return { lines, hasForcedBreak, minScore };
}

// ── Public: estimate how text wraps in a given box ───────
export interface EstimateResult {
  lines: string[];
  availEm: number;
  maxLineEm: number;
  hasForcedBreak: boolean;
}

export function estimateWrap(
  text: string,
  widthIn: number,
  fontSizePt: number,
  opts: WrapOpts = {},
): EstimateResult {
  const avail = availEm(widthIn, fontSizePt, opts);
  const segments = text.split("\n");
  let lines: string[] = [];
  let hasForcedBreak = false;
  for (const seg of segments) {
    const cells = Array.from(seg);
    if (cells.length === 0) { lines.push(""); continue; }
    const r = wrapAt(cells, avail);
    lines = lines.concat(r.lines);
    if (r.hasForcedBreak) hasForcedBreak = true;
  }
  const maxLineEm = lines.reduce((m, l) => Math.max(m, measureEm(l)), 0);
  return { lines, availEm: avail, maxLineEm, hasForcedBreak };
}

// ── Public: rewrite text with natural, balanced breaks ───
/**
 * Insert explicit "\n" so the text wraps at natural (kinsoku-respecting) points
 * and avoids orphan last lines. Single-line text is returned unchanged.
 * Never deletes characters — only inserts line breaks.
 */
export function balanceBreak(
  text: string,
  widthIn: number,
  fontSizePt: number,
  opts: WrapOpts = {},
): string {
  const safety = opts.safety ?? 0.97;
  const avail = availEm(widthIn, fontSizePt, opts) * safety;
  return text
    .split("\n")
    .map((seg) => balanceSegment(seg, avail))
    .join("\n");
}

function maxCellEm(cells: string[]): number {
  let m = 0;
  for (const c of cells) m = Math.max(m, charWidthEm(c));
  return m;
}

function balanceSegment(seg: string, avail: number): string {
  const cells = Array.from(seg);
  if (cells.length === 0) return seg;
  const base = wrapAt(cells, avail);
  const L = base.lines.length;
  if (L < 2) return seg; // fits on one line — leave as-is

  const lastEm = measureEm(base.lines[L - 1]!);
  const orphan = lastEm < Math.max(3.0, 0.35 * avail);

  if (!orphan) {
    // Already natural (candidate-aware greedy); hard-wrap to lock the breakpoints.
    return base.lines.join("\n");
  }

  // Balance: find the smallest target width that still yields ≤ L lines,
  // which evens out line lengths and pulls the orphan up.
  let lo = Math.max(maxCellEm(cells), 1);
  let hi = avail;
  let bestWidth = avail;
  for (let iter = 0; iter < 24 && hi - lo > 0.05; iter++) {
    const mid = (lo + hi) / 2;
    const r = wrapAt(cells, mid);
    // 行数が増えない かつ 禁則を破る強制改行を生まない 幅のみ採用する。
    // （これを許すと "、" や "," が行頭に来る等の不自然な改行が出る）
    if (r.lines.length <= L && !r.hasForcedBreak) {
      bestWidth = mid;
      hi = mid;
    } else {
      lo = mid;
    }
  }
  return wrapAt(cells, bestWidth).lines.join("\n");
}

// ── Public: when auto-fix is impossible, describe why ────
export interface FixSuggestion {
  reason: "overflow" | "too-narrow" | "forced-break";
  detail: string;
}

/**
 * Detect problems that inserting "\n" cannot solve (the content/layout must
 * change). Returns null when the box is fine. The caller (lint-wrap) turns this
 * into a concrete, agent-actionable recommendation with slide context.
 */
export function suggestFix(
  text: string,
  widthIn: number,
  heightIn: number,
  fontSizePt: number,
  opts: WrapOpts & { lineSpacingPt?: number; marginTopPt?: number; marginBottomPt?: number } = {},
): FixSuggestion | null {
  const est = estimateWrap(text, widthIn, fontSizePt, opts);

  // 1) forced break — a token longer than the line, or width too tight for kinsoku
  if (est.hasForcedBreak) {
    return {
      reason: "forced-break",
      detail: `テキストに改行できない長いトークンがある、または幅(${widthIn.toFixed(2)}in)が狭すぎて自然に折り返せない`,
    };
  }

  // 2) too narrow — fewer than 15 full-width chars per line (design-principles §2)
  if (est.availEm < 15 && est.lines.length > 1 && measureEm(text) >= 15) {
    return {
      reason: "too-narrow",
      detail: `1行あたり約${Math.floor(est.availEm)}全角字しか入らない(基準15字)`,
    };
  }

  // 3) vertical overflow — estimated stack of lines taller than the box
  const lineSpacingPt = opts.lineSpacingPt ?? fontSizePt * 1.2;
  const mt = opts.marginTopPt ?? DEFAULT_SIDE_MARGIN_PT;
  const mb = opts.marginBottomPt ?? DEFAULT_SIDE_MARGIN_PT;
  const usableHpt = heightIn * 72 - mt - mb;
  const neededPt = est.lines.length * lineSpacingPt;
  if (est.lines.length > 1 && neededPt > usableHpt * 1.04) {
    return {
      reason: "overflow",
      detail: `推定${est.lines.length}行(${Math.round(neededPt)}pt)がボックス高(${Math.round(usableHpt)}pt)を超える`,
    };
  }

  return null;
}
