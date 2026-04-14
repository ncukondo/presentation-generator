/**
 * Number-card grid — 2-4 parallel cards with large number badges.
 * All cards share the same accent color (design principle: don't index-color
 * parallel items). The signature visual is the circular number badge that
 * straddles the top edge of the card.
 */
import type { Pres, Slide, TextProps } from "../types";
import { C, FONT, FS, MARGIN, CONTENT_W } from "../theme";
import { addBox } from "../helpers";

export interface NumberCardItem {
  heading: string;
  body: string;
  detail?: string;
  footer?: string; // e.g. citation text
}

export interface NumberCardGridOptions {
  y?: number;
  h?: number;
  gap?: number;
  color?: string;
}

export function addNumberCardGrid(
  pres: Pres,
  slide: Slide,
  items: NumberCardItem[],
  opts: NumberCardGridOptions = {},
): void {
  const { y = 2.0, h = 4.3, gap = 0.35, color = C.primary } = opts;
  const n = items.length;
  if (n < 2 || n > 4) {
    throw new Error(`addNumberCardGrid supports 2-4 items, got ${n}`);
  }
  const colW = (CONTENT_W - gap * (n - 1)) / n;
  const numberSize = 0.9;

  items.forEach((item, i) => {
    const x = MARGIN.left + i * (colW + gap);

    // Card body
    slide.addShape(pres.ShapeType.rect, {
      x, y, w: colW, h,
      fill: { color: C.white },
      line: { color: C.lightGray, width: 0.5 },
      rectRadius: 0.08,
    });
    // Left accent stripe
    slide.addShape(pres.ShapeType.rect, {
      x, y, w: 0.12, h,
      fill: { color },
    });

    // Number badge straddling top edge
    slide.addShape(pres.ShapeType.ellipse, {
      x: x + colW / 2 - numberSize / 2, y: y - numberSize / 2 - 0.05,
      w: numberSize, h: numberSize,
      fill: { color },
      line: { color: C.white, width: 3 },
    });
    slide.addText(`0${i + 1}`, {
      x: x + colW / 2 - numberSize / 2, y: y - numberSize / 2 - 0.05,
      w: numberSize, h: numberSize,
      fontSize: FS.heading, fontFace: FONT, color: C.white,
      bold: true, align: "center", valign: "middle",
    });

    // Heading
    slide.addText(item.heading, {
      x: x + 0.3, y: y + numberSize / 2 + 0.1, w: colW - 0.4, h: 0.55,
      fontSize: FS.heading, fontFace: FONT, color,
      bold: true, align: "center", valign: "middle", wrap: true,
    });

    // Body
    const parts: TextProps[] = [
      { text: item.body, options: { fontSize: FS.small, fontFace: FONT, color: C.text, bold: true } },
    ];
    if (item.detail) {
      parts.push({ text: "\n\n" + item.detail, options: { fontSize: FS.small, fontFace: FONT, color: C.darkGray } });
    }
    if (item.footer) {
      parts.push({ text: "\n\n" + item.footer, options: { fontSize: 14, fontFace: FONT, color: C.midGray } });
    }

    addBox(slide, x + 0.25, y + numberSize / 2 + 0.75, colW - 0.5, h - numberSize / 2 - 1.0,
      parts,
      {
        align: "left", valign: "top",
        fill: { color: C.white },
        line: { width: 0 } as any,
        margin: [4, 4, 4, 4],
      },
    );
  });
}
