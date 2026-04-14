import type { Pres } from "../lib/types";
import { C, FONT, FS } from "../lib/theme";
import { addContentSlide, addBox, twoColLayout, addBanner } from "../lib/helpers";
import { addIcon, ICONS } from "../lib/icons";
import { cite } from "../lib/cite";
import { getSlide } from "../lib/slides-data";

export function buildSlide05(pres: Pres) {
  const d = getSlide("risks");
  const risks = d.risks as Array<{ heading: string; body: string; cites: string[] }>;
  const solutions = d.solutions as Array<{
    heading: string; body: string; cites?: string[]; footnote?: string;
  }>;

  const slide = addContentSlide(pres, d.title);
  if (d.narration) slide.addNotes((d.narration as string).trim());

  const { leftX, rightX, colW } = twoColLayout(0.4);
  const gap = 0.2;
  const citeFs = 14;

  // Left column: Risks — use a warning icon to convey meaning, not loud red bands
  renderSection(
    d.risks_heading as string, leftX, colW,
    risks.map((r) => ({ heading: r.heading, body: r.body, cites: r.cites })),
    ICONS.alert,
  );

  // Right column: Solutions — check icon
  renderSection(
    d.solutions_heading as string, rightX, colW,
    solutions.map((s) => ({ heading: s.heading, body: s.body, cites: s.cites, footnote: s.footnote })),
    ICONS.shieldCheck,
  );

  function renderSection(
    heading: string, x: number, w: number,
    items: Array<{ heading: string; body: string; cites?: string[]; footnote?: string }>,
    iconPath: string,
  ) {
    slide.addText(heading, {
      x, y: 1.25, w, h: 0.5,
      fontSize: FS.heading, fontFace: FONT, color: C.primary,
      bold: true, align: "left", valign: "middle",
    });
    const count = items.length;
    const available = 6.2 - 1.85; // cards area end - start
    const cardH = Math.min(2.1, (available - gap * (count - 1)) / count);
    items.forEach((item, i) => {
      const y = 1.85 + i * (cardH + gap);
      slide.addShape(pres.ShapeType.rect, {
        x, y, w, h: cardH,
        fill: { color: C.white },
        line: { color: C.lightGray, width: 0.5 },
        rectRadius: 0.08,
      });
      slide.addShape(pres.ShapeType.rect, {
        x, y, w: 0.1, h: cardH,
        fill: { color: C.primary },
      });
      addIcon(slide, iconPath, x + 0.3, y + 0.22, 0.48, C.primary);
      slide.addText(item.heading, {
        x: x + 0.9, y: y + 0.15, w: w - 1.0, h: 0.5,
        fontSize: FS.small, fontFace: FONT, color: C.primary,
        bold: true, align: "left", valign: "middle", wrap: true,
      });
      const parts: Array<{ text: string; options: Record<string, unknown> }> = [
        { text: item.body, options: { fontSize: FS.small, fontFace: FONT, color: C.text } },
      ];
      if (item.footnote) {
        parts.push({ text: "\n" + item.footnote, options: { fontSize: citeFs, fontFace: FONT, color: C.darkGray } });
      }
      if (item.cites && item.cites.length) {
        const c = item.cites.map((k) => cite(k)).filter(Boolean).join("; ");
        if (c) parts.push({ text: "\n" + c, options: { fontSize: citeFs, fontFace: FONT, color: C.midGray } });
      }
      addBox(slide, x + 0.3, y + 0.7, w - 0.45, cardH - 0.8, parts, {
        align: "left", valign: "top",
        fill: { color: C.white },
        line: { width: 0 } as any,
        margin: [2, 4, 2, 4],
      });
    });
  }

  if (d.banner) {
    addBanner(slide, 6.5, 0.7,
      d.banner as string,
      C.primary, C.white, FS.body,
    );
  }
}
