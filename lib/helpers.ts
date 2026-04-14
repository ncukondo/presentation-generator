import type PptxGenJS from "pptxgenjs";
import type { Pres, Slide, TextProps } from "./types";
import {
  C, FONT, FONT_EN, FS, SLIDE_W, SLIDE_H,
  MARGIN, CONTENT_W, LINE_THIN,
} from "./theme";

// ═══════════════════════════════════════════════════════════
// Slide creation helpers
// ═══════════════════════════════════════════════════════════

/** Create a content slide with warm background and standard title bar. */
export function addContentSlide(pres: Pres, title: string): Slide {
  const slide = pres.addSlide();

  // Warm cream background
  slide.addShape(pres.ShapeType.rect, {
    x: 0, y: 0, w: SLIDE_W, h: SLIDE_H,
    fill: { color: C.warmBg },
  });

  // Title bar
  slide.addShape(pres.ShapeType.rect, {
    x: 0, y: 0, w: SLIDE_W, h: 1.05,
    fill: { color: C.primary },
  });
  slide.addText(title, {
    x: MARGIN.left, y: 0.15, w: CONTENT_W, h: 0.75,
    fontSize: FS.slideTitle, fontFace: FONT, color: C.white,
    bold: true, align: "left", valign: "middle",
  });

  // Accent stripe below title (slightly thicker)
  slide.addShape(pres.ShapeType.rect, {
    x: 0, y: 1.05, w: SLIDE_W, h: 0.08,
    fill: { color: C.accent },
  });

  // Thin accent line at bottom
  slide.addShape(pres.ShapeType.rect, {
    x: 0, y: SLIDE_H - 0.06, w: SLIDE_W, h: 0.06,
    fill: { color: C.accent },
  });

  return slide;
}

/** Create a title slide with decorative circles. */
export function addTitleSlide(
  pres: Pres,
  mainTitle: string,
  subtitle: string,
  presenterInfo: string,
): Slide {
  const slide = pres.addSlide();

  // Base background
  slide.addShape(pres.ShapeType.rect, {
    x: 0, y: 0, w: SLIDE_W, h: SLIDE_H,
    fill: { color: C.primary },
  });

  // Lighter overlay
  slide.addShape(pres.ShapeType.rect, {
    x: 0, y: 0, w: SLIDE_W, h: SLIDE_H,
    fill: { color: C.primaryLight, transparency: 50 },
  });

  // Decorative circles for playful feel
  slide.addShape(pres.ShapeType.ellipse, {
    x: -1.5, y: -1.5, w: 4.5, h: 4.5,
    fill: { color: C.white, transparency: 90 },
  });
  slide.addShape(pres.ShapeType.ellipse, {
    x: 10.5, y: 4.5, w: 5, h: 5,
    fill: { color: C.accentLight, transparency: 82 },
  });
  slide.addShape(pres.ShapeType.ellipse, {
    x: 11.5, y: -2.5, w: 3.5, h: 3.5,
    fill: { color: C.white, transparency: 92 },
  });

  // Accent bar at bottom
  slide.addShape(pres.ShapeType.rect, {
    x: 0, y: SLIDE_H - 0.15, w: SLIDE_W, h: 0.15,
    fill: { color: C.accent },
  });

  slide.addText(mainTitle, {
    x: 1.0, y: 1.0, w: 11.3, h: 2.6,
    fontSize: 48, fontFace: FONT, color: C.white,
    bold: true, align: "center", valign: "middle", wrap: true,
    lineSpacing: 60,
  });
  // Accent underline beneath the title
  slide.addShape(pres.ShapeType.rect, {
    x: (SLIDE_W - 2.2) / 2, y: 3.75, w: 2.2, h: 0.08,
    fill: { color: C.accent },
  });
  slide.addText(subtitle, {
    x: 1.0, y: 3.95, w: 11.3, h: 0.9,
    fontSize: FS.sectionSub, fontFace: FONT, color: C.white,
    bold: true, align: "center", valign: "middle", wrap: true,
  });
  slide.addText(presenterInfo, {
    x: 1.0, y: 5.4, w: 11.3, h: 1.2,
    fontSize: FS.body, fontFace: FONT, color: C.white,
    align: "center", valign: "middle", wrap: true,
    lineSpacing: 28,
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
