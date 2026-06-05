/**
 * Transparently auto-balances every text box and records its geometry for the
 * wrap linter — without touching any pages/*.ts.
 *
 * `instrumentPres(pres)` wraps `pres.addSlide` so that each returned slide's
 * `addText` is patched to:
 *   1. apply `balanceBreak` to plain-string text (natural, kinsoku-aware,
 *      orphan-free line breaks) before handing it to PptxGenJS, and
 *   2. record the (post-fix) text + box geometry into a module-level collector
 *      that `lib/lint-wrap.ts` inspects after the build.
 *
 * Rich-run text (TextProps[]) is left untouched (it is intentionally
 * structured) but still recorded — as concatenated text — so the linter can
 * flag residual problems.
 */
import type { Pres, Slide } from "./types";
import { balanceBreak } from "./text-metrics";

export interface TextEntry {
  slideIdx: number;
  text: string;          // post-balance text actually rendered (joined for rich runs)
  isRichRun: boolean;    // true for TextProps[] inputs (not auto-fixed)
  w: number;             // box width (in)
  h?: number;            // box height (in)
  fontSize: number;      // pt
  fontFace?: string;
  marginLeftPt?: number;
  marginRightPt?: number;
  marginTopPt?: number;
  marginBottomPt?: number;
  lineSpacingPt?: number;
}

let collected: TextEntry[] = [];

export function resetCollected(): void {
  collected = [];
}

export function getCollected(): TextEntry[] {
  return collected;
}

// ── margin / spacing parsing (PptxGenJS points) ──────────
interface Sides { l?: number; r?: number; t?: number; b?: number; }

function parseMargin(margin: unknown): Sides {
  if (typeof margin === "number") return { l: margin, r: margin, t: margin, b: margin };
  if (Array.isArray(margin) && margin.length >= 4) {
    // [v, h, v, h] in practice (e.g. [4,8,4,8]); use indices 1/3 for horizontal.
    return { t: margin[0], r: margin[1], b: margin[2], l: margin[3] };
  }
  return {};
}

function lineSpacingPt(opts: any, fontSize: number): number {
  if (typeof opts?.lineSpacing === "number") return opts.lineSpacing;
  if (typeof opts?.lineSpacingMultiple === "number") return fontSize * opts.lineSpacingMultiple;
  return fontSize * 1.2;
}

function richText(text: any): string {
  // PptxGenJS rich runs: Array<string | { text?: string }>; join the rendered text.
  return text
    .map((run: any) =>
      typeof run === "string" ? run : run && typeof run.text === "string" ? run.text : "",
    )
    .join("");
}

/**
 * Balance each run of a rich-text array independently, using that run's own
 * fontSize (runs in this codebase are paragraph blocks separated by "\n", so
 * per-run balancing matches how they render). Only inserts "\n"; never deletes.
 */
function balanceRichRuns(text: any[], w: number, outerFontSize: number | undefined, m: Sides): any[] {
  const wrapOpts = { marginLeftPt: m.l, marginRightPt: m.r };
  return text.map((run: any) => {
    if (typeof run === "string") {
      return outerFontSize !== undefined ? balanceBreak(run, w, outerFontSize, wrapOpts) : run;
    }
    if (run && typeof run.text === "string") {
      const fs = typeof run.options?.fontSize === "number" ? run.options.fontSize : outerFontSize;
      if (fs !== undefined) {
        return { ...run, text: balanceBreak(run.text, w, fs, wrapOpts) };
      }
    }
    return run;
  });
}

// ── instrumentation ──────────────────────────────────────
export function instrumentPres(pres: Pres): void {
  resetCollected();
  let slideIdx = 0;
  const origAddSlide = pres.addSlide.bind(pres);

  (pres as any).addSlide = (...slideArgs: any[]): Slide => {
    const slide = origAddSlide(...slideArgs);
    const idx = ++slideIdx;
    const origAddText = slide.addText.bind(slide);

    (slide as any).addText = (text: any, opts: any): Slide => {
      const w = typeof opts?.w === "number" ? opts.w : undefined;
      const fontSize = typeof opts?.fontSize === "number" ? opts.fontSize : undefined;
      const m = parseMargin(opts?.margin);

      const isRichRun = Array.isArray(text);
      let outText = text;
      let recordText = isRichRun ? richText(text) : typeof text === "string" ? text : String(text ?? "");

      // Auto-balance line breaks (plain strings and rich-run arrays alike).
      if (w !== undefined) {
        if (!isRichRun && typeof text === "string" && fontSize !== undefined) {
          outText = balanceBreak(text, w, fontSize, { marginLeftPt: m.l, marginRightPt: m.r });
          recordText = outText;
        } else if (isRichRun) {
          outText = balanceRichRuns(text, w, fontSize, m);
          recordText = richText(outText);
        }
      }

      if (w !== undefined && fontSize !== undefined) {
        collected.push({
          slideIdx: idx,
          text: recordText,
          isRichRun,
          w,
          h: typeof opts?.h === "number" ? opts.h : undefined,
          fontSize,
          fontFace: typeof opts?.fontFace === "string" ? opts.fontFace : undefined,
          marginLeftPt: m.l,
          marginRightPt: m.r,
          marginTopPt: m.t,
          marginBottomPt: m.b,
          lineSpacingPt: lineSpacingPt(opts, fontSize),
        });
      }

      return origAddText(outText, opts);
    };

    return slide;
  };
}
