import type { Pres } from "../lib/types";
import { C, FONT, FS, SLIDE_W, SLIDE_H } from "../lib/theme";
import { addIcon, ICONS } from "../lib/icons";
import { getSlide } from "../lib/slides-data";

const TIMELINE_BAND_COLOR = C.primary;

export function buildSlide07(pres: Pres) {
  const d = getSlide("closing");
  const timeline = d.timeline as Array<{ time: string; duration: string; desc: string }>;

  const slide = pres.addSlide();
  if (d.narration) slide.addNotes((d.narration as string).trim());

  // Background
  slide.addShape(pres.ShapeType.rect, {
    x: 0, y: 0, w: SLIDE_W, h: SLIDE_H,
    fill: { color: C.primary },
  });
  slide.addShape(pres.ShapeType.rect, {
    x: 0, y: 0, w: SLIDE_W, h: SLIDE_H,
    fill: { color: C.primaryLight, transparency: 50 },
  });

  // Decorative circles (match title slide)
  slide.addShape(pres.ShapeType.ellipse, {
    x: -2, y: 4, w: 5, h: 5,
    fill: { color: C.accentLight, transparency: 85 },
  });
  slide.addShape(pres.ShapeType.ellipse, {
    x: 11, y: -2, w: 4, h: 4,
    fill: { color: C.white, transparency: 90 },
  });

  // Accent bar at bottom
  slide.addShape(pres.ShapeType.rect, {
    x: 0, y: SLIDE_H - 0.15, w: SLIDE_W, h: 0.15,
    fill: { color: C.accent },
  });

  // Title
  slide.addText(d.title, {
    x: 1.0, y: 0.5, w: 11.3, h: 0.8,
    fontSize: 30, fontFace: FONT, color: C.white,
    bold: true, align: "center", valign: "middle",
  });

  // Timeline items
  const itemW = 3.2;
  const itemH = 2.2;
  const gap = 0.5;
  const totalW = itemW * 3 + gap * 2;
  const startX = (SLIDE_W - totalW) / 2;
  const itemY = 1.7;

  timeline.forEach((item, i) => {
    const x = startX + i * (itemW + gap);
    const color = TIMELINE_BAND_COLOR;
    const bandH = 0.5;

    // Card body (opaque white)
    slide.addShape(pres.ShapeType.rect, {
      x, y: itemY, w: itemW, h: itemH,
      fill: { color: C.white },
      rectRadius: 0.12,
    });

    // Colored top band
    slide.addShape(pres.ShapeType.rect, {
      x, y: itemY, w: itemW, h: bandH,
      fill: { color },
      rectRadius: 0.12,
    });
    // Cover bottom corners of band so only top is rounded
    slide.addShape(pres.ShapeType.rect, {
      x, y: itemY + bandH - 0.12, w: itemW, h: 0.12,
      fill: { color },
    });

    // Time label (white on colored band)
    slide.addText(item.time, {
      x, y: itemY + 0.02, w: itemW, h: bandH,
      fontSize: FS.heading, fontFace: FONT, color: C.white,
      bold: true, align: "center", valign: "middle",
    });

    // Duration (dark text on white card)
    slide.addText(item.duration, {
      x, y: itemY + bandH + 0.1, w: itemW, h: 0.5,
      fontSize: FS.body, fontFace: FONT, color,
      bold: true, align: "center", valign: "middle",
    });

    // Description (dark text on white card)
    slide.addText(item.desc, {
      x: x + 0.2, y: itemY + bandH + 0.65, w: itemW - 0.4, h: 0.8,
      fontSize: FS.small, fontFace: FONT, color: C.text,
      align: "center", valign: "middle", wrap: true,
    });

    // Arrow (white on blue background)
    if (i < timeline.length - 1) {
      addIcon(slide, ICONS.arrowRight,
        x + itemW + gap / 2 - 0.2, itemY + itemH / 2 - 0.2, 0.4, C.white);
    }
  });

  // Closing message
  slide.addText(
    d.closing_message as string,
    {
      x: 1.0, y: 4.5, w: 11.3, h: 1.2,
      fontSize: FS.heading, fontFace: FONT, color: C.white,
      align: "center", valign: "middle", wrap: true,
      lineSpacing: 36,
    },
  );

  slide.addText(d.closing_sub as string, {
    x: 1.0, y: 5.8, w: 11.3, h: 0.8,
    fontSize: FS.body, fontFace: FONT, color: C.white,
    align: "center", valign: "middle",
  });

  // Conference info
  slide.addText(d.conference as string, {
    x: 1.0, y: 6.6, w: 11.3, h: 0.5,
    fontSize: FS.small, fontFace: FONT, color: C.white,
    align: "center", valign: "middle",
  });
}
