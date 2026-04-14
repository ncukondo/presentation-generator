/**
 * Hero-quote layout — a single full-slide dramatic message.
 * Use for section breaks, closing statements, or key takeaways that
 * deserve a full slide of their own. Breaks monotony of card-heavy decks.
 */
import type { Pres, Slide } from "../types";
import { C, FONT, FS, SLIDE_W, SLIDE_H } from "../theme";

export interface HeroQuoteOptions {
  quote: string;
  attribution?: string;
  /** Optional small eyebrow label above the quote (e.g. "KEY INSIGHT") */
  eyebrow?: string;
}

export function addHeroQuote(pres: Pres, opts: HeroQuoteOptions): Slide {
  const slide = pres.addSlide();

  // Warm background
  slide.addShape(pres.ShapeType.rect, {
    x: 0, y: 0, w: SLIDE_W, h: SLIDE_H,
    fill: { color: C.warmBg },
  });

  // Signature: accent vertical bar on the left
  slide.addShape(pres.ShapeType.rect, {
    x: 0, y: 0, w: 0.35, h: SLIDE_H,
    fill: { color: C.accent },
  });
  slide.addShape(pres.ShapeType.rect, {
    x: 0.35, y: 0, w: 0.08, h: SLIDE_H,
    fill: { color: C.primary },
  });

  if (opts.eyebrow) {
    slide.addText(opts.eyebrow, {
      x: 1.4, y: 1.6, w: 10.5, h: 0.5,
      fontSize: FS.small, fontFace: FONT, color: C.accent,
      bold: true, align: "left", valign: "middle",
      charSpacing: 4,
    });
  }

  slide.addText(opts.quote, {
    x: 1.4, y: opts.eyebrow ? 2.2 : 1.8, w: 10.5, h: 3.8,
    fontSize: 40, fontFace: FONT, color: C.primary,
    bold: true, align: "left", valign: "middle", wrap: true,
    lineSpacing: 56,
  });

  if (opts.attribution) {
    slide.addText(opts.attribution, {
      x: 1.4, y: 6.2, w: 10.5, h: 0.6,
      fontSize: FS.body, fontFace: FONT, color: C.darkGray,
      align: "left", valign: "middle",
    });
  }

  return slide;
}
