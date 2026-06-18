import type PptxGenJS from "pptxgenjs";
import type { Pres, Slide, TextProps } from "./types";
import {
  C, FONT, FS, SLIDE_W, SLIDE_H,
  MARGIN, CONTENT_W, LINE_THIN,
} from "./theme";
import { darken } from "./color";

// ═══════════════════════════════════════════════════════════
// Slide creation helpers
//
// デザイン方針: slate 基調・アクセントは「強調1色」に限定。
// ヘッダー等の常時アクセント装飾は使わない（各スライドで最も見せたい1点だけに
// アクセントを使う）。ここでは中立色のクロームのみを提供する。
// ═══════════════════════════════════════════════════════════

/** Create a content slide with a calm off-white background and a slate title bar. */
export function addContentSlide(pres: Pres, title: string): Slide {
  const slide = pres.addSlide();

  // Calm off-white background
  slide.addShape(pres.ShapeType.rect, {
    x: 0, y: 0, w: SLIDE_W, h: SLIDE_H,
    fill: { color: C.offWhite },
  });

  // Title bar (primary only — no accent decoration)
  slide.addShape(pres.ShapeType.rect, {
    x: 0, y: 0, w: SLIDE_W, h: 1.05,
    fill: { color: C.primary },
  });
  slide.addText(title, {
    x: MARGIN.left, y: 0.15, w: CONTENT_W, h: 0.75,
    fontSize: FS.slideTitle, fontFace: FONT, color: C.white,
    bold: true, align: "left", valign: "middle",
  });

  // Neutral hairline under the header (no accent)
  slide.addShape(pres.ShapeType.line, {
    x: 0, y: 1.07, w: SLIDE_W, h: 0,
    line: { color: C.midGray, width: 1 },
  });

  return slide;
}

/**
 * Title slide — slate editorial: deep background, a thin vertical accent rule on
 * the left, left-aligned headline. The accent appears exactly once.
 */
export function addTitleSlide(
  pres: Pres,
  mainTitle: string,
  subtitle: string | undefined,
  presenterInfo: string,
  eyebrow?: string,
): Slide {
  const slide = pres.addSlide();

  // Deep slate background for depth
  slide.background = { color: darken(C.primary, 0.3) };

  const LX = 1.4;
  // Left vertical accent rule (the single accent on this slide)
  slide.addShape(pres.ShapeType.rect, {
    x: LX, y: 2.5, w: 0.09, h: 2.4,
    fill: { color: C.accent },
  });

  if (eyebrow) {
    slide.addText(eyebrow, {
      x: LX + 0.4, y: 2.45, w: 10.5, h: 0.5,
      fontSize: FS.micro, fontFace: FONT, color: C.midGray,
      align: "left", valign: "middle", charSpacing: 3,
    });
  }

  slide.addText(mainTitle, {
    x: LX + 0.36, y: eyebrow ? 2.95 : 2.7, w: 10.8, h: 1.4,
    fontSize: 50, fontFace: FONT, color: C.white,
    bold: true, align: "left", valign: "middle", wrap: true,
  });

  if (subtitle) {
    slide.addText(subtitle, {
      x: LX + 0.4, y: 4.3, w: 10.5, h: 0.8,
      fontSize: FS.sectionSub, fontFace: FONT, color: C.offWhite,
      align: "left", valign: "middle", wrap: true,
    });
  }

  slide.addText(presenterInfo, {
    x: 4.5, y: 6.45, w: 7.83, h: 0.55,
    fontSize: FS.small, fontFace: FONT, color: C.midGray,
    align: "right", valign: "middle", charSpacing: 1, wrap: true,
  });

  return slide;
}

// ═══════════════════════════════════════════════════════════
// Drawing primitives
// ═══════════════════════════════════════════════════════════

/** Rounded-corner text box. */
export function addBox(
  slide: Slide,
  x: number, y: number, w: number, h: number,
  text: string | TextProps[],
  opts: Partial<PptxGenJS.TextPropsOptions> = {},
) {
  slide.addText(text, {
    x, y, w, h,
    fontSize: FS.body, fontFace: FONT, color: C.text,
    align: "center", valign: "middle",
    fill: { color: C.white },
    line: LINE_THIN,
    margin: [4, 8, 4, 8],
    wrap: true,
    rectRadius: 0.05,
    ...opts,
  });
}

/** Card with colored top band. */
export function addCard(
  slide: Slide,
  x: number, y: number, w: number, h: number,
  title: string,
  body: string | TextProps[],
  bandColor: string,
  opts: Partial<PptxGenJS.TextPropsOptions> = {},
) {
  const bandH = 0.42;
  slide.addShape("rect" as any, {
    x, y, w, h: bandH,
    fill: { color: bandColor },
    rectRadius: 0.05,
  });
  slide.addText(title, {
    x, y, w, h: bandH,
    fontSize: FS.small, fontFace: FONT, color: C.white,
    bold: true, align: "center", valign: "middle",
  });
  addBox(slide, x, y + bandH, w, h - bandH, body, {
    align: "left", valign: "top",
    margin: [8, 10, 8, 10],
    fontSize: FS.small,
    ...opts,
  });
}

// ═══════════════════════════════════════════════════════════
// Layout helpers
// ═══════════════════════════════════════════════════════════

/** Two-column layout. */
export function twoColLayout(gap = 0.5) {
  const colW = (CONTENT_W - gap) / 2;
  return {
    leftX: MARGIN.left,
    rightX: MARGIN.left + colW + gap,
    colW,
  };
}

/** Three-column layout. */
export function threeColLayout(gap = 0.4) {
  const colW = (CONTENT_W - gap * 2) / 3;
  return {
    xs: [
      MARGIN.left,
      MARGIN.left + colW + gap,
      MARGIN.left + (colW + gap) * 2,
    ],
    colW,
  };
}

/** Accent banner (full-width colored strip with text). */
export function addBanner(
  slide: Slide,
  y: number, h: number,
  text: string,
  bgColor: string = C.primary,
  textColor: string = C.white,
  fontSize: number = FS.body,
) {
  slide.addText(text, {
    x: 0, y, w: SLIDE_W, h,
    fontSize, fontFace: FONT, color: textColor,
    bold: true, align: "center", valign: "middle",
    fill: { color: bgColor },
  });
}
