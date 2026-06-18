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
  addContentSlide, addTitleSlide, addBox, twoColLayout, addBanner,
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
    case "section":      return renderSection(pres, s);
    case "bullets":      return renderBullets(pres, s);
    case "agenda":       return renderAgenda(pres, s);
    case "figure":       return renderFigure(pres, s);
    case "split":        return renderSplit(pres, s);
    case "big-stat":     return renderBigStat(pres, s);
    case "evidence":     return renderEvidence(pres, s);
    case "steps":        return renderStepsOverview(pres, s);
    case "step-detail":  return renderStepDetail(pres, s);
    case "risks":        return renderRisks(pres, s);
    case "checklist":    return renderChecklist(pres, s);
    case "closing":      return renderClosing(pres, s);
    case "references":   return renderReferences(pres, s);
    case "statement":    return renderStatement(pres, s);
    // `grid` は number-cards に統合（番号カードの作り方を一本化）。
    case "grid":
    case "number-cards": return renderNumberCards(pres, s);
    case "chart":        return renderChart(pres, s);
    case "table":        return renderTable(pres, s);
    default:
      throw new Error(`unknown layout "${s.layout}" (slide id: ${s.id})`);
  }
}

// ── title (← slide01) ────────────────────────────────────
function renderTitle(pres: Pres, s: DeckSlide): Slide {
  const v = vis(s);
  const slide = addTitleSlide(pres, s.title, v.subtitle as string | undefined, v.presenter as string);
  addNotes(slide, s);
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

  // subtitle / evidence_heading are optional column labels. They share one
  // label row; when BOTH are omitted the columns move up to fill the gap.
  const hasSubtitle = typeof v.subtitle === "string" && (v.subtitle as string).length > 0;
  const hasHeading = typeof v.evidence_heading === "string" && (v.evidence_heading as string).length > 0;
  const labelY = 1.3;
  if (hasSubtitle) {
    slide.addText(v.subtitle as string, {
      x: leftX, y: labelY, w: colW, h: 0.5,
      fontSize: FS.heading, fontFace: FONT, color: C.primary,
      bold: true, align: "left", valign: "middle",
    });
  }
  if (hasHeading) {
    slide.addText(v.evidence_heading as string, {
      x: rightX, y: labelY, w: colW, h: 0.5,
      fontSize: FS.heading, fontFace: FONT, color: C.primary,
      bold: true, align: "left", valign: "middle",
    });
  }
  const colTop = hasSubtitle || hasHeading ? 2.0 : 1.4;

  features.forEach((text, i) => {
    addIcon(slide, ICONS.check, leftX, colTop + i * 0.85, 0.4, C.primary);
    slide.addText(text, {
      x: leftX + 0.5, y: colTop + i * 0.85, w: colW - 0.5, h: 0.8,
      fontSize: FS.small, fontFace: FONT, color: C.text,
      align: "left", valign: "top", wrap: true,
    });
  });

  evidence.forEach((ev, i) => {
    const cardY = colTop + i * 1.55;
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

// ── number-cards (← lib/layouts/number-card-grid; absorbs `grid`) ─────────
// 番号付きカードの唯一の layout。旧 `grid`（3列固定＋subtitle＋cites）はここに統合。
//   - 2-4 件のカード（heading/body/detail/footer/cites）
//   - subtitle（任意）を出すと、旧 grid と同じ位置にカードが下がる
//   - cites（任意の引用キー配列）は detail の下に APA インテキストで表示
// MDI 名は ICONS のセマンティックキー（例 "school"）でも生 MDI 名（例 "school-outline"）でも可。
function resolveIcon(name: string): string {
  return (ICONS as Record<string, string>)[name] ?? name;
}

function renderNumberCards(pres: Pres, s: DeckSlide): Slide {
  const v = vis(s);
  const items = (v.items ?? v.cards) as Array<{
    heading: string; body: string; detail?: string; footer?: string; cites?: string[]; icon?: string;
  }>;
  const slide = addContentSlide(pres, s.title);
  addNotes(slide, s);

  // Optional centered subtitle (grid parity). When present, cards drop down
  // to leave room — defaults match the former `grid` geometry.
  const hasSubtitle = typeof v.subtitle === "string" && v.subtitle.length > 0;
  if (hasSubtitle) {
    slide.addText(v.subtitle as string, {
      x: MARGIN.left, y: 1.25, w: CONTENT_W, h: 0.55,
      fontSize: FS.heading, fontFace: FONT, color: C.primary,
      bold: true, align: "center", valign: "middle",
    });
  }

  const color = (v.color as string) ?? C.primary;
  const n = items.length;
  if (n < 2 || n > 4) {
    throw new Error(`number-cards supports 2-4 items, got ${n} (slide id: ${s.id})`);
  }

  // Badge per card: icon (item.icon) > number (default) > none (badge:"none").
  // 番号バッジは「省略(badge: none)」「アイコン差し替え(item.icon)」が可能。
  const slideBadge = (v.badge as string) ?? "number"; // "number" | "none"
  const cardBadge = items.map((it) =>
    it.icon ? "icon" : slideBadge === "none" ? "none" : "number"
  );
  // バッジが1つでもあれば上部に張り出し帯を確保（行内の高さを揃える）。
  const showBadges = cardBadge.some((b) => b !== "none");

  const gap = (v.gap as number) ?? 0.35;
  const numberSize = 0.9;
  // No-badge では上の張り出し分を取り戻してカードを上げ、縦を広く使う。
  const defaultY = hasSubtitle ? (showBadges ? 2.45 : 2.0) : (showBadges ? 2.0 : 1.55);
  const defaultH = hasSubtitle ? (showBadges ? 4.15 : 4.7) : (showBadges ? 4.3 : 4.85);
  const y = (v.y as number) ?? defaultY;
  const h = (v.h as number) ?? defaultH;
  const colW = (CONTENT_W - gap * (n - 1)) / n;

  // Vertical anchors depend on whether a badge band is reserved.
  const headingY = showBadges ? y + numberSize / 2 + 0.1 : y + 0.3;
  const bodyY = showBadges ? y + numberSize / 2 + 0.75 : y + 0.95;
  const bodyH = showBadges ? h - numberSize / 2 - 1.0 : h - 1.15;

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

    const mode = cardBadge[i];
    if (mode !== "none") {
      const bx = x + colW / 2 - numberSize / 2;
      const by = y - numberSize / 2 - 0.05;
      slide.addShape(pres.ShapeType.ellipse, {
        x: bx, y: by, w: numberSize, h: numberSize,
        fill: { color },
        line: { color: C.white, width: 3 },
      });
      if (mode === "icon") {
        const isz = numberSize * 0.55;
        addIcon(slide, resolveIcon(item.icon!), bx + (numberSize - isz) / 2, by + (numberSize - isz) / 2, isz, C.white);
      } else {
        slide.addText(`0${i + 1}`, {
          x: bx, y: by, w: numberSize, h: numberSize,
          fontSize: FS.heading, fontFace: FONT, color: C.white,
          bold: true, align: "center", valign: "middle",
        });
      }
    }

    slide.addText(item.heading, {
      x: x + 0.3, y: headingY, w: colW - 0.4, h: 0.55,
      fontSize: FS.heading, fontFace: FONT, color,
      bold: true, align: "center", valign: "middle", wrap: true,
    });

    const parts: TextProps[] = [
      { text: item.body, options: { fontSize: FS.small, fontFace: FONT, color: C.text, bold: true } },
    ];
    if (item.detail) {
      parts.push({ text: "\n\n" + item.detail, options: { fontSize: FS.small, fontFace: FONT, color: C.darkGray } });
    }
    if (item.cites && item.cites.length) {
      const citeText = item.cites.map((k) => cite(k)).filter(Boolean).join("; ");
      if (citeText) parts.push({ text: "\n\n" + citeText, options: { fontSize: 14, fontFace: FONT, color: C.midGray } });
    }
    if (item.footer) {
      parts.push({ text: "\n\n" + item.footer, options: { fontSize: 14, fontFace: FONT, color: C.midGray } });
    }

    addBox(slide, x + 0.25, bodyY, colW - 0.5, bodyH,
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

// ── chart (data-driven native chart) ─────────────────────
// PptxGenJS の addChart で「PowerPoint で編集できるネイティブグラフ」を描く。
// 対応: bar（縦棒）/ barH（横棒）/ line / area / pie / doughnut。
// 系列の色はテーマの step1..7 を自動割当てするので、theme 差し替えに追従する。
const CHART_SERIES_COLORS = [
  C.step1, C.step2, C.step3, C.step4, C.step5, C.step6, C.step7,
];

function renderChart(pres: Pres, s: DeckSlide): Slide {
  const v = vis(s);
  const slide = addContentSlide(pres, s.title);
  addNotes(slide, s);

  const kind = ((v.chartType as string) ?? "bar").toLowerCase();
  const categories = (v.categories as string[]) ?? [];
  const series = (v.series as Array<{ name?: string; values: number[] }>) ?? [];

  // Optional centered subtitle under the title bar.
  let topY = 1.35;
  if (v.subtitle) {
    slide.addText(v.subtitle as string, {
      x: MARGIN.left, y: 1.2, w: CONTENT_W, h: 0.5,
      fontSize: FS.heading, fontFace: FONT, color: C.primary,
      bold: true, align: "center", valign: "middle",
    });
    topY = 1.85;
  }

  // Map our (categories, series) shape onto PptxGenJS's {name, labels, values}.
  const isPie = kind === "pie" || kind === "doughnut";
  const data = isPie
    ? [{
        name: series[0]?.name ?? s.title,
        labels: categories,
        values: series[0]?.values ?? [],
      }]
    : series.map((ser, i) => ({
        name: ser.name ?? `系列${i + 1}`,
        labels: categories,
        values: ser.values,
      }));

  // Pie/doughnut color each slice; bar/line/area color each series.
  const colorCount = isPie ? categories.length : series.length;
  const chartColors = Array.from({ length: Math.max(1, colorCount) },
    (_, i) => CHART_SERIES_COLORS[i % CHART_SERIES_COLORS.length]!);

  const horizBar = kind === "barh";
  const typeName: string =
    kind === "line" ? "line" :
    kind === "area" ? "area" :
    kind === "pie" ? "pie" :
    kind === "doughnut" ? "doughnut" :
    "bar";
  const chartType = (pres.ChartType as Record<string, unknown>)[typeName];

  const noteH = v.note ? 0.5 : 0;
  const chartY = topY + 0.05;
  const chartH = SLIDE_H - chartY - 0.35 - noteH;

  const opts: Record<string, unknown> = {
    x: MARGIN.left, y: chartY, w: CONTENT_W, h: chartH,
    chartColors,
    showLegend: series.length > 1 || isPie,
    legendPos: "b",
    legendColor: C.text,
    legendFontFace: FONT,
    legendFontSize: FS.micro,
    showTitle: false,
    dataLabelFontFace: FONT,
    dataLabelColor: C.text,
    dataLabelFontSize: FS.micro,
  };

  if (isPie) {
    opts.showPercent = true;
    opts.showValue = false;
    if (typeName === "doughnut") opts.holeSize = 55;
  } else {
    opts.barDir = horizBar ? "bar" : "col";
    opts.showValue = (v.showValue as boolean) ?? false;
    opts.catAxisLabelColor = C.text;
    opts.catAxisLabelFontFace = FONT;
    opts.catAxisLabelFontSize = FS.micro;
    opts.valAxisLabelColor = C.darkGray;
    opts.valAxisLabelFontFace = FONT;
    opts.valAxisLabelFontSize = FS.micro;
    opts.valGridLine = { color: C.lightGray, style: "solid", size: 0.5 };
    opts.catGridLine = { style: "none" };
  }

  (slide as unknown as { addChart: (t: unknown, d: unknown, o: unknown) => void })
    .addChart(chartType, data, opts);

  if (v.note) {
    slide.addText(v.note as string, {
      x: MARGIN.left, y: SLIDE_H - 0.5, w: CONTENT_W, h: 0.4,
      fontSize: FS.small, fontFace: FONT, color: C.darkGray,
      align: "center", valign: "middle",
    });
  }
  return slide;
}

// ── table (data-driven native table) ─────────────────────
// PptxGenJS の addTable で「PowerPoint で編集できるネイティブ表」を描く。
// header 行は primary 背景＋白字、本文は白/オフ白の交互ストライプ。
function renderTable(pres: Pres, s: DeckSlide): Slide {
  const v = vis(s);
  const slide = addContentSlide(pres, s.title);
  addNotes(slide, s);

  const headers = (v.headers as string[]) ?? [];
  const rows = (v.rows as string[][]) ?? [];

  let topY = 1.4;
  if (v.subtitle) {
    slide.addText(v.subtitle as string, {
      x: MARGIN.left, y: 1.2, w: CONTENT_W, h: 0.5,
      fontSize: FS.heading, fontFace: FONT, color: C.primary,
      bold: true, align: "center", valign: "middle",
    });
    topY = 1.9;
  }

  const tableRows: unknown[] = [];

  if (headers.length) {
    tableRows.push(headers.map((h) => ({
      text: h,
      options: {
        fill: { color: C.primary }, color: C.white, bold: true,
        align: "center", valign: "middle",
        fontFace: FONT, fontSize: FS.small,
      },
    })));
  }

  rows.forEach((row, ri) => {
    const stripe = ri % 2 === 0 ? C.white : C.offWhite;
    tableRows.push(row.map((cell, ci) => ({
      text: String(cell),
      options: {
        fill: { color: stripe },
        color: C.text,
        // First column reads as a row label → emphasize.
        bold: ci === 0,
        align: ci === 0 ? "left" : "center",
        valign: "middle",
        fontFace: FONT, fontSize: FS.small,
      },
    })));
  });

  const noteH = v.note ? 0.5 : 0;
  const tableY = topY;
  const tableH = SLIDE_H - tableY - 0.35 - noteH;

  const opts: Record<string, unknown> = {
    x: MARGIN.left, y: tableY, w: CONTENT_W, h: tableH,
    border: { type: "solid", pt: 0.5, color: C.lightGray },
    align: "center", valign: "middle",
    fontFace: FONT, fontSize: FS.small, color: C.text,
    autoPage: false,
  };
  if (v.colW) opts.colW = v.colW as number[];

  (slide as unknown as { addTable: (r: unknown, o: unknown) => void })
    .addTable(tableRows, opts);

  if (v.note) {
    slide.addText(v.note as string, {
      x: MARGIN.left, y: SLIDE_H - 0.5, w: CONTENT_W, h: 0.4,
      fontSize: FS.small, fontFace: FONT, color: C.darkGray,
      align: "center", valign: "middle",
    });
  }
  return slide;
}

// ── bullets (タイトル＋階層箇条書き本文) ──────────────────
// 学術スライドで最頻出の「素の箇条書き」。序論・考察・まとめ等の散文的な列挙に使う。
// items は文字列、または {text, level?, cites?, bold?}。level 1 で字下げのサブ項目。
type BulletItem = string | { text: string; level?: number; cites?: string[]; bold?: boolean };

// Convert raw bullet items into PptxGenJS TextProps (shared by bullets & split).
function bulletParts(raw: BulletItem[]): TextProps[] {
  return raw.map((it) => {
    const item = typeof it === "string" ? { text: it } : it;
    const level = item.level ?? 0;
    const citeText = (item.cites ?? []).map((k) => cite(k)).filter(Boolean).join("; ");
    const text = item.text + (citeText ? `  ${citeText}` : "");
    return {
      text,
      options: {
        fontSize: level === 0 ? FS.body : FS.small,
        fontFace: FONT,
        color: level === 0 ? C.text : C.darkGray,
        bold: item.bold ?? false,
        bullet: { code: level === 0 ? "2022" : "2013", indent: 18 } as any,
        indentLevel: level,
        breakLine: true,
        paraSpaceAfter: level === 0 ? 10 : 4,
      },
    };
  });
}

function renderBullets(pres: Pres, s: DeckSlide): Slide {
  const v = vis(s);
  const raw = (v.items as BulletItem[]) ?? [];

  const slide = addContentSlide(pres, s.title);
  addNotes(slide, s);

  let topY = 1.45;
  if (v.subtitle) {
    slide.addText(v.subtitle as string, {
      x: MARGIN.left, y: 1.2, w: CONTENT_W, h: 0.5,
      fontSize: FS.heading, fontFace: FONT, color: C.primary,
      bold: true, align: "left", valign: "middle",
    });
    topY = 1.95;
  }

  const parts = bulletParts(raw);

  const noteH = v.note ? 0.5 : 0;
  slide.addText(parts, {
    x: MARGIN.left + 0.25, y: topY, w: CONTENT_W - 0.5,
    h: SLIDE_H - topY - 0.35 - noteH,
    align: "left", valign: "top", wrap: true,
    lineSpacingMultiple: 1.1,
  });

  if (v.note) {
    slide.addText(v.note as string, {
      x: MARGIN.left, y: SLIDE_H - 0.5, w: CONTENT_W, h: 0.4,
      fontSize: FS.small, fontFace: FONT, color: C.darkGray,
      align: "center", valign: "middle",
    });
  }
  return slide;
}

// ── agenda (目次／アウトライン) ───────────────────────────
// 発表冒頭の章立て。番号バッジ＋章タイトル(＋任意の補足)を縦に並べる。3-7 項目向け。
function renderAgenda(pres: Pres, s: DeckSlide): Slide {
  const v = vis(s);
  const raw = (v.items as Array<string | { title: string; desc?: string }>) ?? [];
  const items = raw.map((it) => (typeof it === "string" ? { title: it } : it));

  const slide = addContentSlide(pres, s.title);
  addNotes(slide, s);

  const n = Math.max(1, items.length);
  const areaTop = 1.55;
  const areaH = SLIDE_H - areaTop - 0.45;
  const rowH = areaH / n;
  const badge = Math.min(0.7, rowH - 0.25);
  const badgeX = MARGIN.left + 0.2;
  const textX = badgeX + badge + 0.45;
  const textW = SLIDE_W - MARGIN.right - textX;

  items.forEach((item, i) => {
    const rowY = areaTop + i * rowH;
    const cy = rowY + (rowH - badge) / 2;

    slide.addShape(pres.ShapeType.ellipse, {
      x: badgeX, y: cy, w: badge, h: badge,
      fill: { color: C.primary },
    });
    slide.addText(`${i + 1}`, {
      x: badgeX, y: cy, w: badge, h: badge,
      fontSize: FS.heading, fontFace: FONT, color: C.white,
      bold: true, align: "center", valign: "middle",
    });

    const parts: TextProps[] = [
      { text: item.title, options: { fontSize: FS.heading, fontFace: FONT, color: C.text, bold: true } },
    ];
    if (item.desc) {
      parts.push({ text: "\n" + item.desc, options: { fontSize: FS.small, fontFace: FONT, color: C.darkGray } });
    }
    slide.addText(parts, {
      x: textX, y: rowY, w: textW, h: rowH,
      align: "left", valign: "middle", wrap: true,
    });

    // Hairline separator between rows (not after the last).
    if (i < items.length - 1) {
      slide.addShape(pres.ShapeType.line, {
        x: textX, y: rowY + rowH, w: textW, h: 0,
        line: { color: C.lightGray, width: 0.75 },
      });
    }
  });
  return slide;
}

// ── figure (大きな図1枚＋キャプション＋引用) ──────────────
// 結果の図版用。assets/ 内の画像をコンテンツ領域いっぱいにアスペクト比維持で配置し、
// 下にキャプションと引用を添える。`evidence.figure`（小さい補足画像）とは別用途。
function pngSize(buf: Buffer): { w: number; h: number } {
  // PNG IHDR: width @ byte 16, height @ byte 20 (big-endian uint32).
  if (buf.length >= 24 && buf.readUInt32BE(0) === 0x89504e47) {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }
  return { w: 16, h: 9 }; // fallback aspect for non-PNG
}

function renderFigure(pres: Pres, s: DeckSlide): Slide {
  const v = vis(s);
  const slide = addContentSlide(pres, s.title);
  addNotes(slide, s);

  let topY = 1.4;
  if (v.subtitle) {
    slide.addText(v.subtitle as string, {
      x: MARGIN.left, y: 1.2, w: CONTENT_W, h: 0.5,
      fontSize: FS.heading, fontFace: FONT, color: C.primary,
      bold: true, align: "center", valign: "middle",
    });
    topY = 1.9;
  }

  const hasCaption = !!(v.caption || v.cite);
  const captionH = hasCaption ? 0.7 : 0;
  const boxX = MARGIN.left;
  const boxY = topY;
  const boxW = CONTENT_W;
  const boxH = SLIDE_H - boxY - 0.3 - captionH;

  // Fit image within the box, preserving aspect ratio, centered.
  const file = resolve(ASSETS_DIR, v.image as string);
  const buf = readFileSync(file);
  const { w: nativeW, h: nativeH } = pngSize(buf);
  const scale = Math.min(boxW / nativeW, boxH / nativeH);
  const imgW = (nativeW * scale);
  const imgH = (nativeH * scale);
  const imgX = boxX + (boxW - imgW) / 2;
  const imgY = boxY + (boxH - imgH) / 2;

  slide.addImage({
    data: loadAsset(v.image as string),
    x: imgX, y: imgY, w: imgW, h: imgH,
  });

  if (hasCaption) {
    const capParts: TextProps[] = [];
    if (v.caption) capParts.push({ text: v.caption as string, options: { fontSize: FS.small, fontFace: FONT, color: C.darkGray } });
    if (v.cite) {
      const citeText = cite(v.cite as string);
      if (citeText) capParts.push({ text: (v.caption ? "  " : "") + citeText, options: { fontSize: FS.micro, fontFace: FONT, color: C.midGray } });
    }
    slide.addText(capParts, {
      x: MARGIN.left, y: SLIDE_H - 0.3 - captionH + 0.05, w: CONTENT_W, h: captionH,
      align: "center", valign: "top", wrap: true,
    });
  }
  return slide;
}

// ── section (章扉・セクション区切り) ──────────────────────
// 深い primary 全面＋単一アクセント＋大きな章番号＋章タイトル。statement（引用調）
// とは見た目で住み分ける。number / eyebrow / subtitle はすべて任意。
function renderSection(pres: Pres, s: DeckSlide): Slide {
  const v = vis(s);
  const slide = pres.addSlide();
  addNotes(slide, s);

  slide.addShape(pres.ShapeType.rect, {
    x: 0, y: 0, w: SLIDE_W, h: SLIDE_H,
    fill: { color: darken(C.primary, 0.3) },
  });

  const LX = 1.4;
  // Single accent rule (the only accent on the slide).
  slide.addShape(pres.ShapeType.rect, {
    x: LX, y: 2.4, w: 0.09, h: 2.7,
    fill: { color: C.accent },
  });
  const TX = LX + 0.45;

  if (v.eyebrow) {
    slide.addText(v.eyebrow as string, {
      x: TX, y: 2.15, w: 10.5, h: 0.5,
      fontSize: FS.small, fontFace: FONT, color: C.midGray,
      bold: true, align: "left", valign: "middle", charSpacing: 4,
    });
  }

  const hasNumber = v.number !== undefined && v.number !== null && v.number !== "";
  if (hasNumber) {
    slide.addText(String(v.number), {
      x: TX, y: v.eyebrow ? 2.6 : 2.35, w: 10.5, h: 1.3,
      fontSize: 64, fontFace: FONT, color: C.accent,
      bold: true, align: "left", valign: "middle",
    });
  }

  slide.addText(s.title, {
    x: TX, y: hasNumber ? 3.85 : (v.eyebrow ? 2.85 : 2.6), w: 10.6, h: 1.3,
    fontSize: 44, fontFace: FONT, color: C.white,
    bold: true, align: "left", valign: "middle", wrap: true,
  });

  if (v.subtitle) {
    slide.addText(v.subtitle as string, {
      x: TX, y: hasNumber ? 5.1 : 4.1, w: 10.6, h: 0.9,
      fontSize: FS.body, fontFace: FONT, color: C.offWhite,
      align: "left", valign: "top", wrap: true,
    });
  }
  return slide;
}

// ── split (汎用2カラム: テキスト ⇔ 図) ───────────────────
// 左にテキスト/箇条書き、右に図（または左右逆）。「図と説明を横に並べる」最頻出形。
// imageSide で図の左右を切替（既定 right）。subtitle / caption / note は任意。
function renderSplit(pres: Pres, s: DeckSlide): Slide {
  const v = vis(s);
  const raw = (v.items as BulletItem[]) ?? [];

  const slide = addContentSlide(pres, s.title);
  addNotes(slide, s);

  let topY = 1.4;
  if (v.subtitle) {
    slide.addText(v.subtitle as string, {
      x: MARGIN.left, y: 1.2, w: CONTENT_W, h: 0.5,
      fontSize: FS.heading, fontFace: FONT, color: C.primary,
      bold: true, align: "left", valign: "middle",
    });
    topY = 1.9;
  }

  const gap = 0.5;
  const colW = (CONTENT_W - gap) / 2;
  const imageSide = (v.imageSide as string) === "left" ? "left" : "right";
  const imgX = imageSide === "left" ? MARGIN.left : MARGIN.left + colW + gap;
  const txtX = imageSide === "left" ? MARGIN.left + colW + gap : MARGIN.left;

  const noteH = v.note ? 0.5 : 0;
  const capH = v.caption ? 0.55 : 0;
  const areaH = SLIDE_H - topY - 0.35 - noteH;

  // Text column (bullets).
  slide.addText(bulletParts(raw), {
    x: txtX + 0.1, y: topY, w: colW - 0.1, h: areaH,
    align: "left", valign: "top", wrap: true, lineSpacingMultiple: 1.1,
  });

  // Image column — fit within the half, preserving aspect ratio, centered.
  if (v.image) {
    const buf = readFileSync(resolve(ASSETS_DIR, v.image as string));
    const { w: nw, h: nh } = pngSize(buf);
    const boxH = areaH - capH;
    const scale = Math.min(colW / nw, boxH / nh);
    const iw = nw * scale, ih = nh * scale;
    const iy = topY + (boxH - ih) / 2;
    slide.addImage({
      data: loadAsset(v.image as string),
      x: imgX + (colW - iw) / 2, y: iy, w: iw, h: ih,
    });
    if (v.caption) {
      // Caption sits directly beneath the image (not the column bottom).
      slide.addText(v.caption as string, {
        x: imgX, y: iy + ih + 0.08, w: colW, h: capH,
        fontSize: FS.micro, fontFace: FONT, color: C.midGray,
        align: "center", valign: "top", wrap: true,
      });
    }
  }

  if (v.note) {
    slide.addText(v.note as string, {
      x: MARGIN.left, y: SLIDE_H - 0.5, w: CONTENT_W, h: 0.4,
      fontSize: FS.small, fontFace: FONT, color: C.darkGray,
      align: "center", valign: "middle",
    });
  }
  return slide;
}

// ── big-stat (巨大数値の強調 1-3個) ──────────────────────
// 「95%」級の大きな数値＋ラベルを 1-3 個並べるインパクトスライド。
// value のみ必須。label / sub / subtitle / note は任意。
function renderBigStat(pres: Pres, s: DeckSlide): Slide {
  const v = vis(s);
  const stats = (v.stats as Array<{ value: string; label?: string; sub?: string }>) ?? [];

  const slide = addContentSlide(pres, s.title);
  addNotes(slide, s);

  let topY = 1.6;
  if (v.subtitle) {
    slide.addText(v.subtitle as string, {
      x: MARGIN.left, y: 1.25, w: CONTENT_W, h: 0.5,
      fontSize: FS.heading, fontFace: FONT, color: C.primary,
      bold: true, align: "center", valign: "middle",
    });
    topY = 2.1;
  }

  const n = Math.min(3, Math.max(1, stats.length));
  const gap = 0.5;
  const colW = (CONTENT_W - gap * (n - 1)) / n;
  const noteH = v.note ? 0.5 : 0;
  const areaH = SLIDE_H - topY - 0.4 - noteH;
  const valueFs = n === 1 ? 120 : n === 2 ? 96 : 80;

  stats.slice(0, n).forEach((stat, i) => {
    const x = MARGIN.left + i * (colW + gap);

    slide.addText(String(stat.value), {
      x, y: topY, w: colW, h: areaH * 0.55,
      fontSize: valueFs, fontFace: FONT_EN, color: C.accent,
      bold: true, align: "center", valign: "bottom",
    });
    if (stat.label) {
      slide.addText(stat.label, {
        x, y: topY + areaH * 0.57, w: colW, h: areaH * 0.2,
        fontSize: FS.heading, fontFace: FONT, color: C.text,
        bold: true, align: "center", valign: "top", wrap: true,
      });
    }
    if (stat.sub) {
      slide.addText(stat.sub, {
        x, y: topY + areaH * 0.78, w: colW, h: areaH * 0.2,
        fontSize: FS.small, fontFace: FONT, color: C.darkGray,
        align: "center", valign: "top", wrap: true,
      });
    }
  });

  if (v.note) {
    slide.addText(v.note as string, {
      x: MARGIN.left, y: SLIDE_H - 0.5, w: CONTENT_W, h: 0.4,
      fontSize: FS.small, fontFace: FONT, color: C.darkGray,
      align: "center", valign: "middle",
    });
  }
  return slide;
}
