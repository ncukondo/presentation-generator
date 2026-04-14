import type { Pres } from "../lib/types";
import { C, FONT, FS, MARGIN, CONTENT_W } from "../lib/theme";
import { addContentSlide, addBox, threeColLayout } from "../lib/helpers";
import { cite } from "../lib/cite";
import { getSlide } from "../lib/slides-data";

export function buildSlide02(pres: Pres) {
  const d = getSlide("background");
  const cards = d.cards as Array<{
    heading: string; body: string; detail: string; cites: string[];
  }>;

  const slide = addContentSlide(pres, d.title);
  if (d.narration) slide.addNotes((d.narration as string).trim());

  slide.addText(
    d.subtitle as string,
    {
      x: MARGIN.left, y: 1.25, w: CONTENT_W, h: 0.55,
      fontSize: FS.heading, fontFace: FONT, color: C.primary,
      bold: true, align: "center", valign: "middle",
    },
  );

  const { xs, colW } = threeColLayout(0.35);
  const cardY = 2.45;
  const cardH = 4.15;
  const numberSize = 0.9;
  const bandH = 0.55;
  const citeFs = 14;

  cards.forEach((card, i) => {
    const x = xs[i]!;
    const citeText = card.cites.map((k) => cite(k)).join("; ");

    // White card body with colored left accent stripe
    slide.addShape(pres.ShapeType.rect, {
      x, y: cardY, w: colW, h: cardH,
      fill: { color: C.white },
      line: { color: C.lightGray, width: 0.5 },
      rectRadius: 0.08,
    });
    slide.addShape(pres.ShapeType.rect, {
      x, y: cardY, w: 0.12, h: cardH,
      fill: { color: C.primary },
    });

    // Large number badge — repeats across cards as the signature element
    slide.addShape(pres.ShapeType.ellipse, {
      x: x + colW / 2 - numberSize / 2, y: cardY - numberSize / 2 - 0.05,
      w: numberSize, h: numberSize,
      fill: { color: C.primary },
      line: { color: C.white, width: 3 },
    });
    slide.addText(`0${i + 1}`, {
      x: x + colW / 2 - numberSize / 2, y: cardY - numberSize / 2 - 0.05,
      w: numberSize, h: numberSize,
      fontSize: FS.heading, fontFace: FONT, color: C.white,
      bold: true, align: "center", valign: "middle",
    });

    // Heading
    slide.addText(card.heading, {
      x: x + 0.3, y: cardY + numberSize / 2 + 0.1, w: colW - 0.4, h: bandH,
      fontSize: FS.heading, fontFace: FONT, color: C.primary,
      bold: true, align: "center", valign: "middle", wrap: true,
    });

    // Body paragraph
    addBox(slide, x + 0.25, cardY + numberSize / 2 + 0.75, colW - 0.5, cardH - numberSize / 2 - 1.0,
      [
        { text: card.body + "\n\n", options: { fontSize: FS.small, fontFace: FONT, color: C.text, bold: true } },
        { text: card.detail + "\n", options: { fontSize: FS.small, fontFace: FONT, color: C.darkGray } },
        { text: citeText, options: { fontSize: citeFs, fontFace: FONT, color: C.midGray } },
      ],
      {
        align: "left", valign: "top",
        fill: { color: C.white },
        line: { width: 0 } as any,
        margin: [4, 4, 4, 4],
      },
    );
  });
}
