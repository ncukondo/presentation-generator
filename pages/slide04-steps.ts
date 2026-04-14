import type { Pres } from "../lib/types";
import { C, FONT, FS, MARGIN, CONTENT_W } from "../lib/theme";
import { addContentSlide } from "../lib/helpers";
import { addIcon, ICONS } from "../lib/icons";
import { getSlide } from "../lib/slides-data";

const STEP_ICONS = [
  ICONS.magnify, ICONS.shieldCheck, ICONS.cloudUpload, ICONS.fileDocument,
  ICONS.messageText, ICONS.cog, ICONS.check,
];

export function buildSlide04(pres: Pres) {
  const d = getSlide("steps-overview");
  const stepLabels = d.steps as string[];

  const slide = addContentSlide(pres, d.title);
  if (d.narration) slide.addNotes((d.narration as string).trim());

  slide.addText(d.subtitle as string, {
    x: MARGIN.left, y: 1.25, w: CONTENT_W, h: 0.5,
    fontSize: FS.heading, fontFace: FONT, color: C.primary,
    bold: true, align: "center", valign: "middle",
  });

  // 2-row grid: 4 steps on top, 3 on bottom. Wider columns avoid character-by-character wrap.
  const rowCounts = [4, 3];
  const stepH = 2.05;
  const gap = 0.25;
  const rowGap = 0.3;
  const startY = 1.85;
  const numSize = 0.6;
  const iconSize = 0.5;

  // Use the wider column width (from the 3-card row) for both rows so labels
  // don't wrap awkwardly on the 4-card row. The 4-card row still uses 4 cards,
  // but we match column widths by keeping stepW consistent and centering rows.
  const maxCount = Math.max(...rowCounts);
  const baseStepW = (CONTENT_W - gap * (maxCount - 1)) / maxCount;

  let index = 0;
  rowCounts.forEach((count, rowIdx) => {
    const stepW = baseStepW;
    const rowTotalW = stepW * count + gap * (count - 1);
    const startX = MARGIN.left + (CONTENT_W - rowTotalW) / 2;
    const rowY = startY + rowIdx * (stepH + rowGap);

    for (let c = 0; c < count; c++) {
      const i = index++;
      const label = stepLabels[i];
      if (!label) return;
      const x = startX + c * (stepW + gap);

      // Card
      slide.addShape(pres.ShapeType.rect, {
        x, y: rowY, w: stepW, h: stepH,
        fill: { color: C.white },
        line: { color: C.primary, width: 1 },
        rectRadius: 0.08,
      });
      // Top accent strip
      slide.addShape(pres.ShapeType.rect, {
        x, y: rowY, w: stepW, h: 0.1,
        fill: { color: C.primary },
      });

      // Number badge + icon side-by-side, horizontally centered on the card
      const headerY = rowY + 0.25;
      const groupW = numSize + 0.15 + iconSize;
      const groupX = x + (stepW - groupW) / 2;

      slide.addShape(pres.ShapeType.ellipse, {
        x: groupX, y: headerY, w: numSize, h: numSize,
        fill: { color: C.primary },
      });
      slide.addText(`${i + 1}`, {
        x: groupX, y: headerY, w: numSize, h: numSize,
        fontSize: FS.heading, fontFace: FONT, color: C.white,
        bold: true, align: "center", valign: "middle",
      });
      addIcon(slide, STEP_ICONS[i]!,
        groupX + numSize + 0.15, headerY + (numSize - iconSize) / 2,
        iconSize, C.primary);

      // Label fills below — minimal padding to maximize width for wrapping
      slide.addText(label, {
        x: x + 0.05, y: rowY + 0.25 + numSize + 0.15, w: stepW - 0.1, h: stepH - numSize - 0.55,
        fontSize: FS.body, fontFace: FONT, color: C.text,
        align: "center", valign: "middle", wrap: true,
        lineSpacing: 28,
        margin: [0, 0, 0, 0],
      });
    }
  });

  // Bottom note — below row 2 which ends at startY + stepH*2 + rowGap
  if (d.note) {
    const noteY = startY + stepH * 2 + rowGap + 0.15;
    slide.addText(d.note as string, {
      x: MARGIN.left, y: noteY, w: CONTENT_W, h: 0.4,
      fontSize: FS.small, fontFace: FONT, color: C.darkGray,
      align: "center", valign: "middle",
    });
  }
}
