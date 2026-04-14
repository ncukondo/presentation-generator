import type { Pres } from "../lib/types";
import { C, FONT, FS, MARGIN, CONTENT_W, SLIDE_W } from "../lib/theme";
import { addContentSlide, addBox } from "../lib/helpers";
import { addIcon, ICONS } from "../lib/icons";
import { getSlide } from "../lib/slides-data";

const ITEM_ICONS = [ICONS.accountGroup, ICONS.robot, ICONS.lightbulb, ICONS.fileDocument];

export function buildSlide06(pres: Pres) {
  const d = getSlide("preparation");
  const items = d.items as Array<{
    title: string; desc: string; url?: string; warning?: string;
  }>;

  const slide = addContentSlide(pres, d.title);
  if (d.narration) slide.addNotes((d.narration as string).trim());

  slide.addText(d.subtitle as string, {
    x: MARGIN.left, y: 1.25, w: CONTENT_W, h: 0.5,
    fontSize: FS.heading, fontFace: FONT, color: C.primary,
    bold: true, align: "center", valign: "middle",
  });

  const cardW = 5.7;
  const cardH = 1.8;
  const gapX = 0.4;
  const gapY = 0.35;
  const startX = (SLIDE_W - cardW * 2 - gapX) / 2;
  const startY = 2.1;

  items.forEach((item, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = startX + col * (cardW + gapX);
    const y = startY + row * (cardH + gapY);

    // Card background
    addBox(slide, x, y, cardW, cardH, "", {
      fill: { color: C.offWhite },
    });

    // Number circle — anchored to card top for consistent alignment
    const numY = y + 0.3;
    slide.addShape(pres.ShapeType.ellipse, {
      x: x + 0.2, y: numY, w: 0.55, h: 0.55,
      fill: { color: C.primary },
    });
    slide.addText(`${i + 1}`, {
      x: x + 0.2, y: numY, w: 0.55, h: 0.55,
      fontSize: FS.heading, fontFace: FONT, color: C.white,
      bold: true, align: "center", valign: "middle",
    });

    // Title + Description + optional URL
    const textParts: { text: string; options: Record<string, unknown> }[] = [
      { text: `${item.title}\n`, options: { fontSize: FS.body, fontFace: FONT, color: C.text, bold: true } },
      { text: item.desc, options: { fontSize: FS.small, fontFace: FONT, color: C.darkGray } },
    ];
    if (item.url) {
      textParts.push(
        { text: `\n${item.url}`, options: { fontSize: 14, fontFace: FONT, color: C.darkGray } },
      );
    }
    if (item.warning) {
      textParts.push(
        { text: `\n${item.warning}`, options: { fontSize: FS.small, fontFace: FONT, color: "E53935" } },
      );
    }
    slide.addText(textParts, {
      x: x + 0.95, y: y + 0.15, w: cardW - 1.15, h: cardH - 0.3,
      align: "left", valign: "top", wrap: true,
    });
  });
}
