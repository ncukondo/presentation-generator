import { readFileSync } from "fs";
import { resolve } from "path";
import type { Pres } from "../lib/types";
import { C, FONT, FS, MARGIN, CONTENT_W } from "../lib/theme";
import { addContentSlide, addBox, twoColLayout } from "../lib/helpers";
import { addIcon, ICONS } from "../lib/icons";
import { cite } from "../lib/cite";
import { getSlide } from "../lib/slides-data";

export function buildSlide03(pres: Pres) {
  const d = getSlide("notebooklm");
  const features = d.features as string[];
  const evidence = d.evidence as Array<{ heading: string; body: string; cite: string }>;

  const slide = addContentSlide(pres, d.title);
  if (d.narration) slide.addNotes((d.narration as string).trim());

  const { leftX, rightX, colW } = twoColLayout(0.5);
  const citeFs = 14;

  // Left column: What is NotebookLM
  slide.addText(d.subtitle as string, {
    x: leftX, y: 1.3, w: colW, h: 0.5,
    fontSize: FS.heading, fontFace: FONT, color: C.primary,
    bold: true, align: "left", valign: "middle",
  });

  features.forEach((text, i) => {
    addIcon(slide, ICONS.check, leftX, 2.0 + i * 0.85, 0.4, C.primary);
    slide.addText(text, {
      x: leftX + 0.5, y: 2.0 + i * 0.85, w: colW - 0.5, h: 0.8,
      fontSize: FS.small, fontFace: FONT, color: C.text,
      align: "left", valign: "top", wrap: true,
    });
  });

  // Right column: Evidence — consistent styling across cards (no index-based coloring)
  slide.addText(d.evidence_heading as string, {
    x: rightX, y: 1.3, w: colW, h: 0.5,
    fontSize: FS.heading, fontFace: FONT, color: C.primary,
    bold: true, align: "left", valign: "middle",
  });

  evidence.forEach((ev, i) => {
    const cardY = 2.0 + i * 1.55;
    const cardH = 1.35;
    // Left accent stripe for signature consistency with slide02
    slide.addShape(pres.ShapeType.rect, {
      x: rightX, y: cardY, w: 0.12, h: cardH,
      fill: { color: C.primary },
    });
    const citeText = cite(ev.cite);
    const parts: Array<{ text: string; options: Record<string, unknown> }> = [
      { text: ev.heading + "\n", options: { fontSize: FS.small, fontFace: FONT, color: C.primary, bold: true } },
      { text: ev.body, options: { fontSize: FS.small, fontFace: FONT, color: C.text } },
    ];
    if (citeText) parts.push({ text: "\n" + citeText, options: { fontSize: citeFs, fontFace: FONT, color: C.midGray } });
    addBox(slide, rightX, cardY, colW, cardH,
      parts,
      { align: "left", valign: "middle", fill: { color: C.cardBlue }, margin: [6, 14, 6, 14] },
    );
  });

  // 補足画像（slides.yaml の figure フィールドで指定、省略時はスキップ）
  if (d.figure) {
    const figPath = resolve(import.meta.dir, `../assets/${d.figure}`);
    const figData = `image/png;base64,${readFileSync(figPath).toString("base64")}`;
    const figSize = 2.1;
    slide.addImage({
      data: figData,
      x: 2.28, y: 5.03, w: figSize, h: figSize,
    });
    if (d.figure_cite) {
      slide.addText(cite(d.figure_cite as string), {
        x: 2.27, y: 7.1, w: 2.78, h: 0.3,
        fontSize: 12, fontFace: FONT, color: C.midGray,
        align: "left", valign: "middle",
      });
    }
  }

  // URL at bottom — neutral color (accent reserved for single CTA per slide)
  if (d.url) {
    slide.addText(d.url as string, {
      x: MARGIN.left, y: 6.6, w: CONTENT_W, h: 0.5,
      fontSize: FS.body, fontFace: FONT, color: C.darkGray,
      align: "center", valign: "middle",
    });
  }
}
