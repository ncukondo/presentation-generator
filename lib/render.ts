/**
 * Data-driven slide renderers.
 *
 * `renderSlide(pres, slide)` dispatches on `slide.layout` — there is NO `id`
 * reference anywhere. Every layout-specific parameter is read from `slide.visual`.
 * Each renderer is a faithful port of the former `pages/slideXX-*.ts` builder,
 * with the only change being that data comes from `slide.visual` instead of
 * `getSlide(id)`. Speaker notes (`slide.narration`) are applied uniformly right
 * after slide creation, exactly as the page builders did.
 *
 * To add a one-off figure: add a `case "my-figure"` below plus a `renderMyFigure`
 * function. Authors then write `layout: my-figure` in slides.yaml — no `id` wiring.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import type { Pres, Slide, TextProps } from "./types";
import { C, FONT, FONT_EN, FS, SLIDE_W, SLIDE_H, MARGIN, CONTENT_W } from "./theme";
import {
  addContentSlide, addTitleSlide, addBox, twoColLayout, threeColLayout, addBanner,
} from "./helpers";
import { addIcon, ICONS } from "./icons";
import { cite, getUsedCitations } from "./cite";
import { darken } from "./color";
import type { DeckSlide } from "./deck";

// ── Helpers ──────────────────────────────────────────────
function vis(s: DeckSlide): Record<string, unknown> {
  return (s.visual ?? {}) as Record<string, unknown>;
}
// PowerPoint のノート欄に入れる文字列を決める。
//   - `notes`     … ノート専用メモ（TTS/動画では読み上げない）。優先。
//   - `narration` … TTS/動画の読み上げ原稿。`notes` 未指定時はこれをノートにも使う。
// ナレーション不要なデッキは `notes` だけ書けばよい（音声は生成されない）。
function addNotes(slide: Slide, s: DeckSlide): void {
  const note = (s.notes ?? s.narration) as string | undefined;
  if (note) slide.addNotes(note.trim());
}

// ── Dispatcher ───────────────────────────────────────────
export function renderSlide(pres: Pres, s: DeckSlide): Slide | undefined {
  switch (s.layout) {
    case "title":        return renderTitle(pres, s);
    case "grid":         return renderGrid(pres, s);
    case "evidence":     return renderEvidence(pres, s);
    case "steps":        return renderStepsOverview(pres, s);
    case "step-detail":  return renderStepDetail(pres, s);
    case "risks":        return renderRisks(pres, s);
    case "checklist":    return renderChecklist(pres, s);
    case "closing":      return renderClosing(pres, s);
    case "references":   return renderReferences(pres, s);
    case "statement":    return renderStatement(pres, s);
    case "number-cards": return renderNumberCards(pres, s);
    default:
      throw new Error(`unknown layout "${s.layout}" (slide id: ${s.id})`);
  }
}

// ── title (← slide01) ────────────────────────────────────
function renderTitle(pres: Pres, s: DeckSlide): Slide {
  const v = vis(s);
  const slide = addTitleSlide(pres, s.title, v.subtitle as string, v.presenter as string);
  addNotes(slide, s);
  return slide;
}

// ── grid (← slide02 background) ──────────────────────────
function renderGrid(pres: Pres, s: DeckSlide): Slide {
  const v = vis(s);
  const cards = v.cards as Array<{
    heading: string; body: string; detail?: string; cites?: string[];
  }>;

  const slide = addContentSlide(pres, s.title);
  addNotes(slide, s);

  slide.addText(v.subtitle as string, {
    x: MARGIN.left, y: 1.25, w: CONTENT_W, h: 0.55,
    fontSize: FS.heading, fontFace: FONT, color: C.primary,
    bold: true, align: "center", valign: "middle",
  });

  const { xs, colW } = threeColLayout(0.35);
  const cardY = 2.45;
  const cardH = 4.15;
  const numberSize = 0.9;
  const bandH = 0.55;
  const citeFs = 14;

  cards.forEach((card, i) => {
    const x = xs[i]!;
    const citeText = (card.cites ?? []).map((k) => cite(k)).join("; ");

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

    slide.addText(card.heading, {
      x: x + 0.3, y: cardY + numberSize / 2 + 0.1, w: colW - 0.4, h: bandH,
      fontSize: FS.heading, fontFace: FONT, color: C.primary,
      bold: true, align: "center", valign: "middle", wrap: true,
    });

    addBox(slide, x + 0.25, cardY + numberSize / 2 + 0.75, colW - 0.5, cardH - numberSize / 2 - 1.0,
      [
        { text: card.body + "\n\n", options: { fontSize: FS.small, fontFace: FONT, color: C.text, bold: true } },
        { text: card.detail ? card.detail + "\n" : "", options: { fontSize: FS.small, fontFace: FONT, color: C.darkGray } },
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
  return slide;
}

// ── evidence (← slide03 notebooklm) ──────────────────────
function renderEvidence(pres: Pres, s: DeckSlide): Slide {
  const v = vis(s);
  const features = v.features as string[];
  const evidence = v.evidence as Array<{ heading: string; body: string; cite: string }>;

  const slide = addContentSlide(pres, s.title);
  addNotes(slide, s);

  const { leftX, rightX, colW } = twoColLayout(0.5);
  const citeFs = 14;

  slide.addText(v.subtitle as string, {
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

  slide.addText(v.evidence_heading as string, {
    x: rightX, y: 1.3, w: colW, h: 0.5,
    fontSize: FS.heading, fontFace: FONT, color: C.primary,
    bold: true, align: "left", valign: "middle",
  });

  evidence.forEach((ev, i) => {
    const cardY = 2.0 + i * 1.55;
    const cardH = 1.35;
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

  if (v.figure) {
    const figPath = resolve(import.meta.dir, `../assets/${v.figure}`);
    const figData = `image/png;base64,${readFileSync(figPath).toString("base64")}`;
    const figSize = 2.1;
    slide.addImage({
      data: figData,
      x: 2.28, y: 5.03, w: figSize, h: figSize,
    });
    if (v.figure_cite) {
      slide.addText(cite(v.figure_cite as string), {
        x: 2.27, y: 7.1, w: 2.78, h: 0.3,
        fontSize: 12, fontFace: FONT, color: C.midGray,
        align: "left", valign: "middle",
      });
    }
  }

  if (v.url) {
    slide.addText(v.url as string, {
      x: MARGIN.left, y: 6.6, w: CONTENT_W, h: 0.5,
      fontSize: FS.body, fontFace: FONT, color: C.darkGray,
      align: "center", valign: "middle",
    });
  }
  return slide;
}

// ── steps (← slide04 steps-overview) ─────────────────────
const STEP_ICONS = [
  ICONS.magnify, ICONS.shieldCheck, ICONS.cloudUpload, ICONS.fileDocument,
  ICONS.messageText, ICONS.cog, ICONS.check,
];

function renderStepsOverview(pres: Pres, s: DeckSlide): Slide {
  const v = vis(s);
  const stepLabels = v.steps as string[];

  const slide = addContentSlide(pres, s.title);
  addNotes(slide, s);

  slide.addText(v.subtitle as string, {
    x: MARGIN.left, y: 1.25, w: CONTENT_W, h: 0.5,
    fontSize: FS.heading, fontFace: FONT, color: C.primary,
    bold: true, align: "center", valign: "middle",
  });

  const rowCounts = [4, 3];
  const stepH = 2.05;
  const gap = 0.25;
  const rowGap = 0.3;
  const startY = 1.85;
  const numSize = 0.6;
  const iconSize = 0.5;

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

      slide.addShape(pres.ShapeType.rect, {
        x, y: rowY, w: stepW, h: stepH,
        fill: { color: C.white },
        line: { color: C.primary, width: 1 },
        rectRadius: 0.08,
      });
      slide.addShape(pres.ShapeType.rect, {
        x, y: rowY, w: stepW, h: 0.1,
        fill: { color: C.primary },
      });

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

      slide.addText(label, {
        x: x + 0.05, y: rowY + 0.25 + numSize + 0.15, w: stepW - 0.1, h: stepH - numSize - 0.55,
        fontSize: FS.body, fontFace: FONT, color: C.text,
        align: "center", valign: "middle", wrap: true,
        lineSpacing: 28,
        margin: [0, 0, 0, 0],
      });
    }
  });

  if (v.note) {
    const noteY = startY + stepH * 2 + rowGap + 0.15;
    slide.addText(v.note as string, {
      x: MARGIN.left, y: noteY, w: CONTENT_W, h: 0.4,
      fontSize: FS.small, fontFace: FONT, color: C.darkGray,
      align: "center", valign: "middle",
    });
  }
  return slide;
}

// ── step-detail (← slide04-step-details) ─────────────────
const SCREENSHOT_DIR = resolve(import.meta.dir, "../screenshots");
const ASSETS_DIR = resolve(import.meta.dir, "../assets");

function loadImage(filepath: string): string {
  const buf = readFileSync(filepath);
  const ext = filepath.endsWith(".png") ? "png" : "jpeg";
  return `image/${ext};base64,${buf.toString("base64")}`;
}
function loadScreenshot(filename: string): string {
  return loadImage(resolve(SCREENSHOT_DIR, filename));
}
function loadAsset(filename: string): string {
  return loadImage(resolve(ASSETS_DIR, filename));
}

interface ArrowAnnotation { x: number; y: number; rotate?: number }
interface TextAnnotation { text: string; x: number; y: number; w: number; h: number; fontSize: number }
interface RectAnnotation { x: number; y: number; w: number; h: number }
interface ImageOverlay { asset: string; x: number; y: number; w: number; h: number }

const ARROW_W = 0.45;
const ARROW_H = 0.38;
const ARROW_COLOR = "FF0000";

function renderStepDetail(pres: Pres, s: DeckSlide): Slide {
  const v = vis(s);
  const step = (v.step as number) ?? 0;

  const slide = addContentSlide(pres, `Step ${step}：${s.title}`);
  addNotes(slide, s);

  const defaultH = 5.2;
  const defaultW = defaultH * (16 / 9);
  const imgH = (v.imgH as number) ?? defaultH;
  const imgW = (v.imgW as number) ?? defaultW;
  const imgX = (SLIDE_W - imgW) / 2;
  const frameY = 1.35;
  const imgY = (v.imgY as number) ?? frameY + (defaultH - imgH) / 2;

  // Shadow frame behind screenshot (always full-size)
  slide.addShape(pres.ShapeType.rect, {
    x: imgX - 0.06, y: frameY - 0.06,
    w: imgW + 0.12, h: defaultH + 0.12,
    fill: { color: C.white },
    line: { color: C.midGray, width: 0.5 },
    shadow: {
      type: "outer", blur: 4, offset: 2,
      angle: 135, color: "000000", opacity: 0.15,
    },
  });

  // Screenshot image
  slide.addImage({
    data: loadScreenshot(v.screenshot as string),
    x: imgX, y: imgY, w: imgW, h: imgH,
  });

  // Note text below shadow frame
  slide.addText(v.note as string, {
    x: MARGIN.left, y: frameY + defaultH + 0.15,
    w: CONTENT_W, h: 0.45,
    fontSize: FS.small, fontFace: FONT, color: C.darkGray,
    align: "center", valign: "middle",
  });

  // Overlay images (e.g. CC banner)
  const overlayImages = v.overlayImages as ImageOverlay[] | undefined;
  if (overlayImages) {
    for (const img of overlayImages) {
      slide.addImage({
        data: loadAsset(img.asset),
        x: img.x, y: img.y, w: img.w, h: img.h,
      });
    }
  }

  // Red arrow annotations
  const arrows = v.arrows as ArrowAnnotation[] | undefined;
  if (arrows) {
    for (const arrow of arrows) {
      slide.addShape("rightArrow" as any, {
        x: arrow.x, y: arrow.y, w: ARROW_W, h: ARROW_H,
        fill: { color: ARROW_COLOR },
        line: { color: ARROW_COLOR },
        rotate: arrow.rotate ?? 0,
      });
    }
  }

  // Red rectangle annotations (frame only, no fill)
  const rectAnnotations = v.rectAnnotations as RectAnnotation[] | undefined;
  if (rectAnnotations) {
    for (const rect of rectAnnotations) {
      slide.addShape(pres.ShapeType.rect, {
        x: rect.x, y: rect.y, w: rect.w, h: rect.h,
        fill: { type: "none" as any },
        line: { color: ARROW_COLOR, width: 6 },
      });
    }
  }

  // Text annotations
  const textAnnotations = v.textAnnotations as TextAnnotation[] | undefined;
  if (textAnnotations) {
    for (const ann of textAnnotations) {
      slide.addText(ann.text, {
        x: ann.x, y: ann.y, w: ann.w, h: ann.h,
        fontSize: ann.fontSize, fontFace: FONT, color: ARROW_COLOR,
        bold: true, align: "left", valign: "middle",
      });
    }
  }
  return slide;
}

// ── risks (← slide05) ────────────────────────────────────
function renderRisks(pres: Pres, s: DeckSlide): Slide {
  const v = vis(s);
  const risks = v.risks as Array<{ heading: string; body: string; cites: string[] }>;
  const solutions = v.solutions as Array<{
    heading: string; body: string; cites?: string[]; footnote?: string;
  }>;

  const slide = addContentSlide(pres, s.title);
  addNotes(slide, s);

  const { leftX, rightX, colW } = twoColLayout(0.4);
  const gap = 0.2;
  const citeFs = 14;

  renderSection(
    v.risks_heading as string, leftX, colW,
    risks.map((r) => ({ heading: r.heading, body: r.body, cites: r.cites })),
    ICONS.alert,
  );

  renderSection(
    v.solutions_heading as string, rightX, colW,
    solutions.map((sol) => ({ heading: sol.heading, body: sol.body, cites: sol.cites, footnote: sol.footnote })),
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
    const available = 6.2 - 1.85;
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

  if (v.banner) {
    addBanner(slide, 6.5, 0.7,
      v.banner as string,
      C.primary, C.white, FS.body,
    );
  }
  return slide;
}

// ── checklist (← slide06 preparation) ────────────────────
function renderChecklist(pres: Pres, s: DeckSlide): Slide {
  const v = vis(s);
  const items = v.items as Array<{
    title: string; desc: string; url?: string; warning?: string;
  }>;

  const slide = addContentSlide(pres, s.title);
  addNotes(slide, s);

  slide.addText(v.subtitle as string, {
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

    addBox(slide, x, y, cardW, cardH, "", {
      fill: { color: C.offWhite },
    });

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
  return slide;
}

// ── closing (← slide07) ──────────────────────────────────
const TIMELINE_BAND_COLOR = C.primary;

function renderClosing(pres: Pres, s: DeckSlide): Slide {
  const v = vis(s);
  const timeline = v.timeline as Array<{ time: string; duration: string; desc: string }>;

  const slide = pres.addSlide();
  addNotes(slide, s);

  // Deep slate background (bookends the title) — no overlay, blobs, or accent bar.
  slide.addShape(pres.ShapeType.rect, {
    x: 0, y: 0, w: SLIDE_W, h: SLIDE_H,
    fill: { color: darken(C.primary, 0.3) },
  });

  slide.addText(s.title, {
    x: 1.0, y: 0.5, w: 11.3, h: 0.8,
    fontSize: 30, fontFace: FONT, color: C.white,
    bold: true, align: "center", valign: "middle",
  });

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

    slide.addShape(pres.ShapeType.rect, {
      x, y: itemY, w: itemW, h: itemH,
      fill: { color: C.white },
      rectRadius: 0.12,
    });

    slide.addShape(pres.ShapeType.rect, {
      x, y: itemY, w: itemW, h: bandH,
      fill: { color },
      rectRadius: 0.12,
    });
    slide.addShape(pres.ShapeType.rect, {
      x, y: itemY + bandH - 0.12, w: itemW, h: 0.12,
      fill: { color },
    });

    slide.addText(item.time, {
      x, y: itemY + 0.02, w: itemW, h: bandH,
      fontSize: FS.heading, fontFace: FONT, color: C.white,
      bold: true, align: "center", valign: "middle",
    });

    slide.addText(item.duration, {
      x, y: itemY + bandH + 0.1, w: itemW, h: 0.5,
      fontSize: FS.body, fontFace: FONT, color,
      bold: true, align: "center", valign: "middle",
    });

    slide.addText(item.desc, {
      x: x + 0.2, y: itemY + bandH + 0.65, w: itemW - 0.4, h: 0.8,
      fontSize: FS.small, fontFace: FONT, color: C.text,
      align: "center", valign: "middle", wrap: true,
    });

    if (i < timeline.length - 1) {
      addIcon(slide, ICONS.arrowRight,
        x + itemW + gap / 2 - 0.2, itemY + itemH / 2 - 0.2, 0.4, C.white);
    }
  });

  slide.addText(v.closing_message as string, {
    x: 1.0, y: 4.5, w: 11.3, h: 1.2,
    fontSize: FS.heading, fontFace: FONT, color: C.white,
    align: "center", valign: "middle", wrap: true,
    lineSpacing: 36,
  });

  slide.addText(v.closing_sub as string, {
    x: 1.0, y: 5.8, w: 11.3, h: 0.8,
    fontSize: FS.body, fontFace: FONT, color: C.white,
    align: "center", valign: "middle",
  });

  slide.addText(v.conference as string, {
    x: 1.0, y: 6.6, w: 11.3, h: 0.5,
    fontSize: FS.small, fontFace: FONT, color: C.white,
    align: "center", valign: "middle",
  });
  return slide;
}

// ── references (← slide08, auto-collected citations) ─────
function renderReferences(pres: Pres, _s: DeckSlide): Slide | undefined {
  const citations = getUsedCitations();
  if (citations.length === 0) return undefined;

  const slide = addContentSlide(pres, "References");

  const refFs = 12;
  const titleBarH = 1.13;
  const startY = titleBarH + 0.1;
  const colGap = 0.3;
  const colW = (CONTENT_W - colGap) / 2;
  const colH = SLIDE_H - startY - 0.25;
  const mid = Math.ceil(citations.length / 2);

  [citations.slice(0, mid), citations.slice(mid)].forEach((col, ci) => {
    const x = MARGIN.left + ci * (colW + colGap);
    const textRuns = col.flatMap((c, i) => [
      ...(i > 0 ? [{ text: "\n", options: { fontSize: refFs } }] : []),
      { text: c.apa + "\n", options: { fontSize: refFs, fontFace: FONT_EN, color: C.text } },
    ]);
    slide.addText(textRuns, {
      x, y: startY, w: colW, h: colH,
      fontSize: refFs, fontFace: FONT_EN, color: C.text,
      align: "left", valign: "top",
      wrap: true, lineSpacingMultiple: 1.15,
    });
  });
  return slide;
}

// ── statement (← lib/layouts/hero-quote) ─────────────────
function renderStatement(pres: Pres, s: DeckSlide): Slide {
  const v = vis(s);
  const slide = pres.addSlide();
  addNotes(slide, s);

  slide.addShape(pres.ShapeType.rect, {
    x: 0, y: 0, w: SLIDE_W, h: SLIDE_H,
    fill: { color: C.warmBg },
  });

  slide.addShape(pres.ShapeType.rect, {
    x: 0, y: 0, w: 0.35, h: SLIDE_H,
    fill: { color: C.accent },
  });
  slide.addShape(pres.ShapeType.rect, {
    x: 0.35, y: 0, w: 0.08, h: SLIDE_H,
    fill: { color: C.primary },
  });

  if (v.eyebrow) {
    slide.addText(v.eyebrow as string, {
      x: 1.4, y: 1.6, w: 10.5, h: 0.5,
      fontSize: FS.small, fontFace: FONT, color: C.darkGray,
      bold: true, align: "left", valign: "middle",
      charSpacing: 4,
    });
  }

  slide.addText((v.quote ?? s.title) as string, {
    x: 1.4, y: v.eyebrow ? 2.2 : 1.8, w: 10.5, h: 3.8,
    fontSize: 40, fontFace: FONT, color: C.primary,
    bold: true, align: "left", valign: "middle", wrap: true,
    lineSpacing: 56,
  });

  if (v.attribution) {
    slide.addText(v.attribution as string, {
      x: 1.4, y: 6.2, w: 10.5, h: 0.6,
      fontSize: FS.body, fontFace: FONT, color: C.darkGray,
      align: "left", valign: "middle",
    });
  }
  return slide;
}

// ── number-cards (← lib/layouts/number-card-grid) ────────
function renderNumberCards(pres: Pres, s: DeckSlide): Slide {
  const v = vis(s);
  const items = (v.items ?? v.cards) as Array<{
    heading: string; body: string; detail?: string; footer?: string;
  }>;
  const slide = addContentSlide(pres, s.title);
  addNotes(slide, s);

  const y = (v.y as number) ?? 2.0;
  const h = (v.h as number) ?? 4.3;
  const gap = (v.gap as number) ?? 0.35;
  const color = (v.color as string) ?? C.primary;
  const n = items.length;
  if (n < 2 || n > 4) {
    throw new Error(`number-cards supports 2-4 items, got ${n} (slide id: ${s.id})`);
  }
  const colW = (CONTENT_W - gap * (n - 1)) / n;
  const numberSize = 0.9;

  items.forEach((item, i) => {
    const x = MARGIN.left + i * (colW + gap);

    slide.addShape(pres.ShapeType.rect, {
      x, y, w: colW, h,
      fill: { color: C.white },
      line: { color: C.lightGray, width: 0.5 },
      rectRadius: 0.08,
    });
    slide.addShape(pres.ShapeType.rect, {
      x, y, w: 0.12, h,
      fill: { color },
    });

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

    slide.addText(item.heading, {
      x: x + 0.3, y: y + numberSize / 2 + 0.1, w: colW - 0.4, h: 0.55,
      fontSize: FS.heading, fontFace: FONT, color,
      bold: true, align: "center", valign: "middle", wrap: true,
    });

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
  return slide;
}
