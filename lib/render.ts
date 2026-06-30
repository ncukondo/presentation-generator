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
import { darken, mixWhite } from "./color";
import { estimateWrap } from "./text-metrics";
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
    case "self-intro":   return renderSelfIntro(pres, s);
    case "demo":         return renderDemo(pres, s);
    case "section-recap": return renderSectionRecap(pres, s);
    case "data-flow":    return renderDataFlow(pres, s);
    case "spectrum":     return renderSpectrum(pres, s);
    case "usage-bars":   return renderUsageBars(pres, s);
    case "compare-paths": return renderComparePaths(pres, s);
    case "nested-layers": return renderNestedLayers(pres, s);
    case "agent-loop":   return renderAgentLoop(pres, s);
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

  const refFs = 12;
  const lineSpacing = 1.15;
  const titleBarH = 1.13;
  const startY = titleBarH + 0.1;
  const colGap = 0.3;
  const colsPerPage = 2;
  const colW = (CONTENT_W - colGap * (colsPerPage - 1)) / colsPerPage;
  const colH = SLIDE_H - startY - 0.25;

  // 行高(in)とカラムに収まる行数。引用間に空行1つを挟む。
  // PowerPoint の単一行高は約 1.2×フォントサイズ。これに行間倍率を掛けた実測寄りの値で見積もる
  // （素朴な fontSize/72 だと過小評価して下端で見切れる）。さらに安全率を掛けて1行余裕を持たせる。
  const lineH = (refFs / 72) * 1.2 * lineSpacing;
  const maxLines = Math.max(1, Math.floor((colH / lineH) * 0.95));

  // 各引用の折り返し行数を見積もる（実レンダリングが1行多く折り返す場合に備え幅を少し狭めに見る）
  const entries = citations.map((c) => ({
    apa: c.apa,
    lines: estimateWrap(c.apa, colW * 0.96, refFs).lines.length,
  }));

  // 順序（アルファベット順）を保ったまま、カラム高 capH を上限に貪欲詰めしたとき
  // 必要カラム数を返す。capH を二分探索で詰めると、最小カラム数のまま各カラムへ均等配分でき、
  // 最終スライドが1件だけで間延びするのを防げる（順序固定なので貪欲＝最小カラム数で最適）。
  const packCols = (capH: number): number => {
    let cols = 1, used = 0;
    for (const e of entries) {
      const cost = e.lines + (used > 0 ? 1 : 0);
      if (used > 0 && used + cost > capH) { cols++; used = e.lines; }
      else used += cost;
    }
    return cols;
  };
  const tallest = entries.reduce((m, e) => Math.max(m, e.lines), 1);
  const minCols = packCols(maxLines);
  // minCols 本に収まる最小の capH（=均等高さ）を二分探索
  let lo = tallest, hi = maxLines;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (packCols(mid) <= minCols) hi = mid; else lo = mid + 1;
  }
  const capH = lo;

  // 決めた capH でカラムへ分配（空行込み）
  const columns: Array<typeof entries> = [[]];
  let used = 0;
  for (const e of entries) {
    const cur = columns[columns.length - 1]!;
    const cost = e.lines + (cur.length > 0 ? 1 : 0); // 2件目以降は前に空行
    if (cur.length > 0 && used + cost > capH) {
      columns.push([e]);
      used = e.lines;
    } else {
      cur.push(e);
      used += cost;
    }
  }

  // colsPerPage カラムごとに1スライド
  let firstSlide: Slide | undefined;
  for (let p = 0; p < columns.length; p += colsPerPage) {
    const slide = addContentSlide(pres, "References");
    if (!firstSlide) firstSlide = slide;
    for (let ci = 0; ci < colsPerPage; ci++) {
      const col = columns[p + ci];
      if (!col) break;
      const x = MARGIN.left + ci * (colW + colGap);
      const textRuns = col.flatMap((c, i) => [
        ...(i > 0 ? [{ text: "\n", options: { fontSize: refFs } }] : []),
        { text: c.apa + "\n", options: { fontSize: refFs, fontFace: FONT_EN, color: C.text } },
      ]);
      slide.addText(textRuns, {
        x, y: startY, w: colW, h: colH,
        fontSize: refFs, fontFace: FONT_EN, color: C.text,
        align: "left", valign: "top",
        wrap: true, lineSpacingMultiple: lineSpacing,
      });
    }
  }
  return firstSlide;
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

// ═══════════════════════════════════════════════════════════
// Layouts contributed from the JSME ICT lecture deck (2026).
// ═══════════════════════════════════════════════════════════

// デモ短縮版 mp4（demos/output/）をスライドに埋め込む一点物レイアウト。
// 上映用に tools/set-video-autoplay.sh で自動再生＋ループ化する前提。
// 動画は slides/ の外（プロジェクト直下 demos/output/）にあり、/tmp ビルドでは
// 相対パスが解決できないため、build.sh が DEMO_DIR を絶対パスで渡す。
const DEMO_DIR = process.env.DEMO_DIR
  ? resolve(process.env.DEMO_DIR)
  : resolve(import.meta.dir, "../../demos/output");
const DEMO_ASPECT = 2240 / 1400; // 録画窓のアスペクト比（≒1.6）。ポスターが読めない時のフォールバック

// "xxx-short.mp4" / "xxx.mp4" → 既定ポスター "xxx.png"
function defaultPoster(video: string): string {
  return video.replace(/-short\.mp4$/, ".mp4").replace(/\.mp4$/, ".png");
}

// 動画ごとのアスペクト比。ブラウザ系デモは「画面のみ」に再クロップ済みで
// 窓の既定比（1.6）と異なるため、ポスターPNGの IHDR 実寸から算出する（外部ツール不要）。
// 動画とポスターは同じ box でクロップしてあるので両者の比は一致する。
function posterAspect(path: string): number | undefined {
  try {
    const b = readFileSync(path);
    // PNG シグネチャ + IHDR（width=16..19, height=20..23, big-endian）
    if (b.length < 24 || b[0] !== 0x89 || b[1] !== 0x50) return undefined;
    const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
    if (w > 0 && h > 0) return w / h;
  } catch { /* fall through to default */ }
  return undefined;
}

function renderDemo(pres: Pres, s: DeckSlide): Slide {
  const v = vis(s);
  const slide = addContentSlide(pres, s.title);
  addNotes(slide, s);

  const video = v.video as string;
  const poster = (v.poster as string) ?? defaultPoster(video);
  const eyebrow = v.eyebrow as string | undefined;
  const points = (v.points as string[] | undefined) ?? [];
  const tryit = v.tryit as string | undefined;          // 参加者が手元で試す実プロンプト
  const tryitLabel = (v.tryit_label as string) ?? "お手元でも試せます";
  const citeText = (v.cites as string[] | undefined)?.map((k) => cite(k)).filter(Boolean).join("; ")
    ?? cite(v.cite as string);

  // 章タグはタイトルバー内に控えめに（右寄せ・小）。動画の領域を奪わない。
  if (eyebrow) {
    slide.addText(eyebrow, {
      x: SLIDE_W - MARGIN.right - 3.4, y: 0.32, w: 3.4, h: 0.45,
      fontSize: FS.small, fontFace: FONT, color: C.midGray,
      align: "right", valign: "middle",
    });
  }

  // 動画を主役に：下に確保する帯（試すプロンプト枠 or ポイント行）以外を動画へ。
  const vidTop = 1.22;
  // 出典は最下部に置くので、その分の余白を底に確保し、下の枠（tryit）と重ならないようにする。
  const bottomPad = citeText ? 0.5 : 0.28;
  const gap = 0.14;
  const reserve = tryit ? (v.tryit_qr ? 1.75 : 1.5) : (points.length ? 0.5 : 0);
  const aspect = posterAspect(resolve(DEMO_DIR, poster)) ?? DEMO_ASPECT;
  let vidH = SLIDE_H - bottomPad - vidTop - (reserve ? reserve + gap : 0);
  let vidW = vidH * aspect;
  if (vidW > CONTENT_W) { vidW = CONTENT_W; vidH = vidW / aspect; }
  const vidX = (SLIDE_W - vidW) / 2;
  const vidY = vidTop;

  // 影付きフレーム
  slide.addShape(pres.ShapeType.rect, {
    x: vidX - 0.06, y: vidY - 0.06, w: vidW + 0.12, h: vidH + 0.12,
    fill: { color: C.white },
    line: { color: C.midGray, width: 0.5 },
    shadow: { type: "outer", blur: 4, offset: 2, angle: 135, color: "000000", opacity: 0.15 },
  });

  // ポスター画像（再生前・PNG書き出しでの見た目）。無ければプレイボタン既定。
  let cover: string | undefined;
  try { cover = loadImage(resolve(DEMO_DIR, poster)); } catch { cover = undefined; }
  slide.addMedia({
    type: "video",
    path: resolve(DEMO_DIR, video),
    x: vidX, y: vidY, w: vidW, h: vidH,
    ...(cover ? { cover } : {}),
  } as any);

  const belowY = vidY + vidH + gap;

  if (tryit) {
    // 参加者が手元で同じプロンプトを投げて実践するための枠（全幅でプロンプトを読みやすく）
    const bx = MARGIN.left, bw = CONTENT_W;
    const url = v.tryit_url as string | undefined;
    const qrFile = v.tryit_qr as string | undefined;
    let qrData: string | undefined;
    if (qrFile) { try { qrData = loadAsset(qrFile); } catch { qrData = undefined; } }

    slide.addShape(pres.ShapeType.rect, {
      x: bx, y: belowY, w: bw, h: reserve,
      fill: { color: C.white }, line: { color: C.accent, width: 1.5 }, rectRadius: 0.06,
    });

    // 右側にQR（データ入手導線）。無ければテキストが全幅。
    const qrSize = qrData ? Math.min(reserve - 0.42, 1.25) : 0;
    const textW = bw - 0.5 - (qrData ? qrSize + 0.5 : 0);

    const runs: TextProps[] = [
      { text: "▶ " + tryitLabel, options: { fontSize: FS.micro, color: C.accent, bold: true, breakLine: true } } as any,
      { text: "「" + tryit + "」", options: { fontSize: FS.small, color: C.text, breakLine: true } } as any,
    ];
    if (url && !qrData) {
      runs.push({ text: "擬似データ・プロンプト: " + url, options: { fontSize: FS.micro, color: C.darkGray, breakLine: true } } as any);
    }
    slide.addText(runs as any, {
      x: bx + 0.25, y: belowY + 0.1, w: textW, h: reserve - 0.2,
      fontFace: FONT, align: "left", valign: "middle", wrap: true, paraSpaceBefore: 4,
    });

    if (qrData) {
      const qx = bx + bw - qrSize - 0.3;
      const qy = belowY + (reserve - qrSize - 0.28) / 2;
      slide.addImage({ data: qrData, x: qx, y: qy, w: qrSize, h: qrSize });
      slide.addText("擬似データ・プロンプト", {
        x: qx - 0.4, y: qy + qrSize + 0.02, w: qrSize + 0.8, h: 0.24,
        fontSize: 11, fontFace: FONT, color: C.darkGray, align: "center", valign: "middle",
      });
    }
  } else if (points.length) {
    // テキストはポイントのみ。動画下に1行で中黒区切り。
    slide.addText(points.join("　・　"), {
      x: MARGIN.left, y: belowY, w: CONTENT_W, h: reserve,
      fontSize: FS.small, fontFace: FONT, color: C.darkGray,
      align: "center", valign: "middle", wrap: true,
    });
  }

  // 出典（最下部・右）
  if (citeText) {
    slide.addText(citeText, {
      x: MARGIN.left, y: SLIDE_H - 0.34, w: CONTENT_W, h: 0.28,
      fontSize: FS.micro, fontFace: FONT, color: C.darkGray,
      align: "right", valign: "middle",
    });
  }

  return slide;
}

function renderSelfIntro(pres: Pres, s: DeckSlide): Slide {
  const v = vis(s);
  const papers = (v.papers as Array<{ image: string; caption?: string }>) ?? [];

  const slide = addContentSlide(pres, s.title);
  addNotes(slide, s);

  if (v.subtitle) {
    slide.addText(v.subtitle as string, {
      x: MARGIN.left, y: 1.2, w: CONTENT_W, h: 0.55,
      fontSize: FS.heading, fontFace: FONT, color: C.primary,
      bold: true, align: "center", valign: "middle",
    });
  }

  const hasCaption = papers.some((p) => p.caption);
  const imgTop = v.subtitle ? 2.0 : 1.55;
  const imgH = (v.subtitle ? 4.45 : 4.9) - (v.footnote ? 0.35 : 0);
  const gap = 0.55;

  // 各画像の表示幅（固定高 imgH に対し実寸比で算出）→ 群全体を中央寄せ。
  const dims = papers.map((p) => {
    const { w, h } = pngSize(readFileSync(resolve(import.meta.dir, `../assets/${p.image}`)));
    return { ratio: w / h };
  });
  const widths = dims.map((d) => imgH * d.ratio);
  const totalW = widths.reduce((a, b) => a + b, 0) + gap * (papers.length - 1);
  let x = MARGIN.left + (CONTENT_W - totalW) / 2;

  papers.forEach((p, i) => {
    const w = widths[i]!;
    const data = `image/png;base64,${readFileSync(
      resolve(import.meta.dir, `../assets/${p.image}`),
    ).toString("base64")}`;
    // 紙面感を出す薄いボーダー
    slide.addShape(pres.ShapeType.rect, {
      x: x - 0.03, y: imgTop - 0.03, w: w + 0.06, h: imgH + 0.06,
      fill: { color: C.white }, line: { color: C.lightGray, width: 0.75 },
    });
    slide.addImage({ data, x, y: imgTop, w, h: imgH });
    if (p.caption) {
      slide.addText(p.caption, {
        x: x - 0.25, y: imgTop + imgH + 0.1, w: w + 0.5, h: 0.8,
        fontSize: FS.micro, fontFace: FONT, color: C.darkGray,
        align: "center", valign: "top", wrap: true,
      });
    }
    x += w + gap;
  });

  if (v.footnote) {
    slide.addText(v.footnote as string, {
      x: MARGIN.left, y: SLIDE_H - 0.55, w: CONTENT_W, h: 0.4,
      fontSize: FS.micro, fontFace: FONT, color: C.darkGray,
      align: "center", valign: "middle",
    });
  }
  return slide;
}

function renderSectionRecap(pres: Pres, s: DeckSlide): Slide {
  const v = vis(s);
  const slide = pres.addSlide();
  addNotes(slide, s);

  // 暗い背景（タイトル色）
  slide.addShape(pres.ShapeType.rect, {
    x: 0, y: 0, w: SLIDE_W, h: SLIDE_H, fill: { color: C.primary },
  });
  // タイトル（白）＋アクセントの細罫
  slide.addText(s.title, {
    x: MARGIN.left, y: 0.4, w: CONTENT_W, h: 0.7,
    fontSize: FS.slideTitle, fontFace: FONT, color: C.white, bold: true,
    align: "left", valign: "middle",
  });
  slide.addShape(pres.ShapeType.line, {
    x: MARGIN.left, y: 1.18, w: 2.2, h: 0, line: { color: C.accent, width: 2.5 },
  });

  const methods = (v.methods as Array<{
    level?: string; name: string; trait?: string; fit: string; limit: string;
  }>) ?? [];
  const n = Math.max(methods.length, 1);
  const gap = 0.4;
  const colW = (CONTENT_W - gap * (n - 1)) / n;
  const cardY = 1.65, cardH = 5.25;

  methods.forEach((m, i) => {
    const x = MARGIN.left + i * (colW + gap);
    // 白カード（暗い地に浮かせる）
    slide.addShape(pres.ShapeType.rect, {
      x, y: cardY, w: colW, h: cardH,
      fill: { color: C.white }, line: { color: C.white, width: 0 } as any, rectRadius: 0.08,
      shadow: { type: "outer", blur: 6, offset: 3, angle: 90, color: "000000", opacity: 0.25 },
    });
    // 行為名（カード内・濃色）＋レベルタグ
    slide.addText([
      ...(m.level ? [{ text: m.level + "　", options: { fontSize: FS.micro, fontFace: FONT_EN, color: C.midGray, bold: true } }] : []),
      { text: m.name, options: { fontSize: FS.body, fontFace: FONT, color: C.primary, bold: true } },
    ] as any, {
      x: x + 0.2, y: cardY + 0.18, w: colW - 0.4, h: 0.6,
      align: "center", valign: "middle", wrap: true,
    });
    // 区切り罫
    slide.addShape(pres.ShapeType.line, {
      x: x + 0.3, y: cardY + 0.85, w: colW - 0.6, h: 0, line: { color: C.lightGray, width: 1 },
    });

    const innerX = x + 0.28, innerW = colW - 0.56;
    let by = cardY + 1.05;
    // 特性（任意・一言）
    if (m.trait) {
      slide.addText(m.trait, {
        x: innerX, y: by, w: innerW, h: 0.78,
        fontSize: FS.small, fontFace: FONT, color: C.darkGray,
        align: "left", valign: "top", wrap: true,
      });
      by += 0.95;
    }
    // 向く場面
    slide.addText("向く場面", {
      x: innerX, y: by, w: innerW, h: 0.36,
      fontSize: FS.micro, fontFace: FONT, color: C.primary, bold: true,
      align: "left", valign: "middle",
    });
    slide.addText(m.fit, {
      x: innerX, y: by + 0.38, w: innerW, h: 1.2,
      fontSize: FS.small, fontFace: FONT, color: C.text,
      align: "left", valign: "top", wrap: true,
    });
    // 限界・ハードル
    const ly = cardY + cardH - 1.65;
    slide.addText("限界・ハードル", {
      x: innerX, y: ly, w: innerW, h: 0.36,
      fontSize: FS.micro, fontFace: FONT, color: C.accent, bold: true,
      align: "left", valign: "middle",
    });
    slide.addText(m.limit, {
      x: innerX, y: ly + 0.38, w: innerW, h: 1.2,
      fontSize: FS.small, fontFace: FONT, color: C.text,
      align: "left", valign: "top", wrap: true,
    });
  });
  return slide;
}

function renderDataFlow(pres: Pres, s: DeckSlide): Slide {
  const v = vis(s);
  const slide = addContentSlide(pres, s.title);
  addNotes(slide, s);

  const eyebrow = v.eyebrow as string | undefined;
  if (eyebrow) {
    slide.addText(eyebrow, {
      x: SLIDE_W - MARGIN.right - 3.4, y: 0.32, w: 3.4, h: 0.45,
      fontSize: FS.small, fontFace: FONT, color: C.midGray, align: "right", valign: "middle",
    });
  }

  const lanes = (v.lanes as Array<{
    name: string; home: string; cloud: string;
    flow: "out" | "in"; flow_label: string; note: string; tone: "warn" | "ok";
  }>) ?? [];

  const chipX = 0.45, chipW = 1.5;
  const homeX = 2.2, boxW = 3.0, boxH = 1.4;
  const cloudX = 7.55;
  const arrowX = homeX + boxW + 0.2, arrowW = cloudX - arrowX - 0.2;
  const laneTop0 = 1.35, laneStride = 2.85;

  lanes.slice(0, 2).forEach((ln, i) => {
    const laneTop = laneTop0 + i * laneStride;
    const tone = ln.tone === "ok" ? C.primary : C.accent;
    const boxesY = laneTop + 0.1;
    const cy = boxesY + boxH / 2;

    // レーン名チップ
    slide.addShape(pres.ShapeType.rect, {
      x: chipX, y: cy - 0.45, w: chipW, h: 0.9,
      fill: { color: tone }, rectRadius: 0.1,
    });
    slide.addText(ln.name, {
      x: chipX, y: cy - 0.45, w: chipW, h: 0.9,
      fontSize: FS.small, fontFace: FONT, color: C.white, bold: true,
      align: "center", valign: "middle", wrap: true,
    });

    // 手元（laptop）ボックス
    const drawBox = (bx: number, icon: string, label: string, borderCol: string) => {
      slide.addShape(pres.ShapeType.rect, {
        x: bx, y: boxesY, w: boxW, h: boxH,
        fill: { color: C.white }, line: { color: borderCol, width: 1.25 }, rectRadius: 0.08,
      });
      addIcon(slide, icon, bx + 0.22, cy - 0.34, 0.68, borderCol);
      slide.addText(label, {
        x: bx + 1.05, y: boxesY, w: boxW - 1.2, h: boxH,
        fontSize: FS.small, fontFace: FONT, color: C.text,
        align: "left", valign: "middle", wrap: true,
      });
    };
    drawBox(homeX, "laptop", ln.home, ln.tone === "ok" ? C.primary : C.midGray);
    // データ保全アイコン（手元に留まる側）
    if (ln.tone === "ok") {
      addIcon(slide, "shield-lock-outline", homeX + boxW - 0.5, boxesY + 0.12, 0.34, C.primary);
    }
    drawBox(cloudX, "cloud-outline", ln.cloud, C.midGray);

    // 矢印（out=右向き・accent＝データが外へ／in=左向き・primary＝コードだけ）
    const isOut = ln.flow === "out";
    slide.addShape((isOut ? "rightArrow" : "leftArrow") as any, {
      x: arrowX, y: cy - 0.24, w: arrowW, h: 0.48,
      fill: { color: tone }, line: { color: tone },
    });
    slide.addText(ln.flow_label, {
      x: arrowX - 0.3, y: cy - 0.92, w: arrowW + 0.6, h: 0.4,
      fontSize: FS.micro, fontFace: FONT, color: tone, bold: true,
      align: "center", valign: "middle",
    });

    // 注記（tone 色＋アイコン）
    slide.addText([
      { text: (ln.tone === "ok" ? "✓ " : "⚠ ") + ln.note, options: {} },
    ] as any, {
      x: homeX, y: boxesY + boxH + 0.12, w: cloudX + boxW - homeX, h: 0.5,
      fontSize: FS.small, fontFace: FONT, color: tone, bold: true,
      align: "center", valign: "middle", wrap: true,
    });
  });

  // 出典
  const citeText = (v.cites as string[] | undefined)?.map((k) => cite(k)).filter(Boolean).join("; ")
    ?? cite(v.cite as string);
  if (citeText) {
    slide.addText(citeText, {
      x: MARGIN.left, y: SLIDE_H - 0.34, w: CONTENT_W, h: 0.28,
      fontSize: FS.micro, fontFace: FONT, color: C.darkGray, align: "right", valign: "middle",
    });
  }
  return slide;
}

function renderSpectrum(pres: Pres, s: DeckSlide): Slide {
  const v = vis(s);
  const slide = addContentSlide(pres, s.title);
  addNotes(slide, s);

  // サブタイトル（grid と同体裁・中央）
  if (v.subtitle) {
    slide.addText(v.subtitle as string, {
      x: MARGIN.left, y: 1.2, w: CONTENT_W, h: 0.55,
      fontSize: FS.heading, fontFace: FONT, color: C.primary, bold: true,
      align: "center", valign: "middle", wrap: true,
    });
  }

  const stops = (v.stops as Array<{
    heading: string; icon?: string; body: string; cites?: string[];
  }>) ?? [];

  // ── ジオメトリ ──
  const BX0 = 1.5, BX1 = SLIDE_W - 1.5;        // 帯の両端
  const BAR_Y = 3.7, BAR_H = 0.34;             // グラデーション帯
  const BAR_CY = BAR_Y + BAR_H / 2;
  const fracs = [0.5 / 3, 1.5 / 3, 2.5 / 3];   // 停留点の中心（等間隔）
  const cxOf = (f: number) => BX0 + f * (BX1 - BX0);

  // ── グラデーション帯（左=薄→右=濃の primary で「右ほど強い」を表す） ──
  const SEG = 28;
  const segW = (BX1 - BX0) / SEG;
  for (let i = 0; i < SEG; i++) {
    const t = 0.6 * (1 - i / (SEG - 1));       // 左 0.6（薄）→ 右 0（濃）
    slide.addShape(pres.ShapeType.rect, {
      x: BX0 + i * segW, y: BAR_Y, w: segW + 0.02, h: BAR_H,
      fill: { color: mixWhite(C.primary, t) },
    });
  }
  // 右端の矢じり（方向を明示）。rightArrow は軸部が帯より細く右端に段差(くびれ)が出るため、
  // 軸を持たない純粋な三角形を 90°回転して帯からそのまま広がる矢じりにする。
  const HEAD_L = 0.5;                 // 矢じりの長さ（横方向）
  const HEAD_H = 0.56;                // 矢じりの根元の高さ（帯から広がる）
  const headCx = BX1 - 0.02 + HEAD_L / 2;
  slide.addShape(pres.ShapeType.triangle, {
    x: headCx - HEAD_H / 2, y: BAR_CY - HEAD_L / 2, w: HEAD_H, h: HEAD_L,
    rotate: 90,
    fill: { color: C.primary }, line: { color: C.primary },
  });
  // 軸キャプション（帯の下・中央）
  slide.addText(((v.axis as string) ?? "正確さ・再現性が上がる") + " →", {
    x: BX0, y: BAR_Y + BAR_H + 0.18, w: BX1 - BX0, h: 0.36,
    fontSize: FS.micro, fontFace: FONT, color: C.darkGray, bold: true,
    align: "center", valign: "middle",
  });

  // ── 各停留点（番号は付けない＝序列でなく連続体） ──
  const colW = 3.5;
  stops.slice(0, 3).forEach((st, i) => {
    const cx = cxOf(fracs[i]!);
    const x = cx - colW / 2;

    // アイコン（帯の上）
    if (st.icon) addIcon(slide, st.icon, cx - 0.36, 2.0, 0.72, C.primary);
    // 見出し
    slide.addText(st.heading, {
      x, y: 2.78, w: colW, h: 0.62,
      fontSize: FS.body, fontFace: FONT, color: C.primary, bold: true,
      align: "center", valign: "middle", wrap: true,
    });
    // 帯上のマーカー（白縁ドット）
    const dotD = 0.44;
    slide.addShape(pres.ShapeType.ellipse, {
      x: cx - dotD / 2, y: BAR_CY - dotD / 2, w: dotD, h: dotD,
      fill: { color: C.primary }, line: { color: C.white, width: 2 },
    });
    // 特性（帯の下）
    slide.addText(st.body, {
      x, y: 4.78, w: colW, h: 1.0,
      fontSize: FS.small, fontFace: FONT, color: C.text,
      align: "center", valign: "top", wrap: true,
    });
    // 出典
    const citeText = (st.cites ?? []).map((k) => cite(k)).filter(Boolean).join("; ");
    if (citeText) {
      slide.addText(citeText, {
        x, y: 5.98, w: colW, h: 0.32,
        fontSize: 14, fontFace: FONT, color: C.darkGray,
        align: "center", valign: "middle", wrap: true,
      });
    }
  });

  return slide;
}

function renderUsageBars(pres: Pres, s: DeckSlide): Slide {
  const v = vis(s);
  const slide = addContentSlide(pres, s.title);
  addNotes(slide, s);

  // サブタイトル（grid/spectrum と同体裁・中央）
  if (v.subtitle) {
    slide.addText(v.subtitle as string, {
      x: MARGIN.left, y: 1.12, w: CONTENT_W, h: 0.5,
      fontSize: FS.heading, fontFace: FONT, color: C.primary, bold: true,
      align: "center", valign: "middle", wrap: true,
    });
  }

  const bars = (v.bars as Array<{
    label: string; value: number; cite?: string; highlight?: boolean;
  }>) ?? [];

  // ── ジオメトリ（横棒チャート） ──
  const trackXL = 4.0, trackXR = 12.0;          // 0% と axisMax の x
  const axisMax = (v.axisMax as number) ?? 50;  // 軸の上限（%）
  const pxPerPct = (trackXR - trackXL) / axisMax;
  const chartTop = 1.98, chartBot = 5.02;
  const n = Math.min(bars.length, 6);
  const pitch = (chartBot - chartTop) / n;
  const barH = Math.min(0.46, pitch * 0.66);

  // 目盛りの縦線（背面・薄いグリッド）＋下端の％ラベル
  for (let t = 0; t <= axisMax; t += 10) {
    const gx = trackXL + t * pxPerPct;
    slide.addShape(pres.ShapeType.line, {
      x: gx, y: chartTop, w: 0, h: chartBot - chartTop,
      line: { color: C.lightGray, width: t === 0 ? 1.25 : 0.75 },
    });
    slide.addText(t === axisMax ? `${t}%` : `${t}`, {
      x: gx - 0.5, y: chartBot + 0.04, w: 1.0, h: 0.3,
      fontSize: 14, fontFace: FONT, color: C.darkGray, align: "center", valign: "middle",
    });
  }

  // ── 各バー ──
  bars.slice(0, n).forEach((b, i) => {
    const cy = chartTop + i * pitch + pitch / 2;
    const by = cy - barH / 2;
    const w = Math.max(0.04, b.value * pxPerPct);
    const fill = b.highlight ? C.accent : C.primaryLight;

    // 分類ラベル（右寄せ）＋出典（小さく下段・グレー）
    const cTxt = b.cite ? cite(b.cite) : "";
    slide.addText([
      { text: b.label, options: { fontSize: FS.small, fontFace: FONT, color: C.text, bold: true } },
      ...(cTxt ? [{ text: "\n" + cTxt, options: { fontSize: 13, fontFace: FONT, color: C.darkGray } }] : []),
    ] as any, {
      x: 0.3, y: cy - 0.36, w: trackXL - 0.5, h: 0.72,
      align: "right", valign: "middle", wrap: true,
    });

    // バー本体
    slide.addShape(pres.ShapeType.rect, {
      x: trackXL, y: by, w, h: barH, fill: { color: fill }, rectRadius: 0.04,
    });
    // 数値（バー末尾）
    slide.addText(`${b.value}%`, {
      x: trackXL + w + 0.12, y: cy - 0.3, w: 1.3, h: 0.6,
      fontSize: FS.body, fontFace: FONT, color: b.highlight ? C.accent : C.primary, bold: true,
      align: "left", valign: "middle",
    });
  });

  // ── 結論バナー（2つ目の見出し数字：2025年に過半数） ──
  if (v.banner) {
    const by = 5.55, bh = 0.74, bx = 1.0, bw = SLIDE_W - 2 * bx;
    slide.addShape(pres.ShapeType.rect, {
      x: bx, y: by, w: bw, h: bh, fill: { color: C.primary }, rectRadius: 0.08,
    });
    slide.addText(v.banner as string, {
      x: bx + 0.3, y: by, w: bw - 0.6, h: bh,
      fontSize: FS.body, fontFace: FONT, color: C.white, bold: true,
      align: "center", valign: "middle", wrap: true,
    });
  }

  // ── 脚注（不均一性＋手法の但し書き・中央） ──
  if (v.footnote) {
    slide.addText(v.footnote as string, {
      x: MARGIN.left, y: 6.46, w: CONTENT_W, h: 0.7,
      fontSize: FS.micro, fontFace: FONT, color: C.darkGray,
      align: "center", valign: "middle", wrap: true,
    });
  }

  return slide;
}

function renderComparePaths(pres: Pres, s: DeckSlide): Slide {
  const v = vis(s);
  const slide = addContentSlide(pres, s.title);
  addNotes(slide, s);

  const eyebrow = v.eyebrow as string | undefined;
  if (eyebrow) {
    slide.addText(eyebrow, {
      x: SLIDE_W - MARGIN.right - 3.4, y: 0.32, w: 3.4, h: 0.45,
      fontSize: FS.small, fontFace: FONT, color: C.midGray, align: "right", valign: "middle",
    });
  }

  const left = v.left as { name: string; icon?: string; note: string };
  const right = v.right as { name: string; icon?: string; note: string };
  const diffs = (v.diffs as string[]) ?? [];

  // 上：同じデータ
  const srcW = 4.6, srcX = (SLIDE_W - srcW) / 2, srcY = 1.35, srcH = 0.66;
  slide.addShape(pres.ShapeType.rect, {
    x: srcX, y: srcY, w: srcW, h: srcH, fill: { color: C.primary }, rectRadius: 0.1,
  });
  slide.addText(v.source as string, {
    x: srcX, y: srcY, w: srcW, h: srcH,
    fontSize: FS.body, fontFace: FONT, color: C.white, bold: true,
    align: "center", valign: "middle",
  });

  // 2つの結果ボックス
  const boxW = 5.0, boxH = 1.62, boxY = 2.7;
  const lX = 0.9, rX = SLIDE_W - MARGIN.right - boxW;
  const drawBox = (bx: number, b: { name: string; icon?: string; note: string }) => {
    slide.addShape(pres.ShapeType.rect, {
      x: bx, y: boxY, w: boxW, h: boxH,
      fill: { color: C.white }, line: { color: C.midGray, width: 1 }, rectRadius: 0.08,
    });
    if (b.icon) addIcon(slide, b.icon, bx + 0.28, boxY + 0.26, 0.62, C.primary);
    slide.addText(b.name, {
      x: bx + 1.05, y: boxY + 0.18, w: boxW - 1.2, h: 0.55,
      fontSize: FS.body, fontFace: FONT, color: C.primary, bold: true,
      align: "left", valign: "middle", wrap: true,
    });
    slide.addText(b.note, {
      x: bx + 0.3, y: boxY + 0.78, w: boxW - 0.6, h: 0.74,
      fontSize: FS.small, fontFace: FONT, color: C.text,
      align: "left", valign: "top", wrap: true,
    });
  };
  drawBox(lX, left);
  drawBox(rX, right);

  // 分岐の矢印（source → 各ボックス上辺）
  const arrow = (x2: number) => {
    const x1 = srcX + srcW / 2, y1 = srcY + srcH;
    const y2 = boxY;
    const x = Math.min(x1, x2), y = Math.min(y1, y2);
    const w = Math.abs(x2 - x1), h = Math.abs(y2 - y1);
    const flipV = (y2 > y1) !== (x2 > x1);
    slide.addShape(pres.ShapeType.line, {
      x, y, w, h, flipV,
      line: { color: C.midGray, width: 1.5, endArrowType: "triangle" } as any,
    });
  };
  arrow(lX + boxW / 2);
  arrow(rX + boxW / 2);

  // 中央「一見そっくり」
  if (v.middle) {
    slide.addText(v.middle as string, {
      x: lX + boxW, y: boxY, w: rX - (lX + boxW), h: boxH,
      fontSize: FS.small, fontFace: FONT, color: C.darkGray, bold: true,
      align: "center", valign: "middle", wrap: true,
    });
  }

  // でも中身が違う（AIの弱み）
  const dh = (v.diffs_heading as string) ?? "でも中身が違う（AIが弱いところ）";
  slide.addText(dh, {
    x: MARGIN.left, y: boxY + boxH + 0.25, w: CONTENT_W, h: 0.4,
    fontSize: FS.small, fontFace: FONT, color: C.accent, bold: true,
    align: "center", valign: "middle",
  });
  if (diffs.length) {
    slide.addText(diffs.join("　／　"), {
      x: MARGIN.left, y: boxY + boxH + 0.65, w: CONTENT_W, h: 0.45,
      fontSize: FS.small, fontFace: FONT, color: C.text,
      align: "center", valign: "middle", wrap: true,
    });
  }

  // 結論バナー（アクセント枠）
  const cby = 5.95, cbh = 0.95, cbx = 1.2, cbw = SLIDE_W - 2 * cbx;
  slide.addShape(pres.ShapeType.rect, {
    x: cbx, y: cby, w: cbw, h: cbh,
    fill: { color: C.white }, line: { color: C.accent, width: 1.75 }, rectRadius: 0.08,
  });
  slide.addText(v.conclusion as string, {
    x: cbx + 0.3, y: cby, w: cbw - 0.6, h: cbh,
    fontSize: FS.body, fontFace: FONT, color: C.primary, bold: true,
    align: "center", valign: "middle", wrap: true,
  });

  // 出典
  const citeText = (v.cites as string[] | undefined)?.map((k) => cite(k)).filter(Boolean).join("; ")
    ?? cite(v.cite as string);
  if (citeText) {
    slide.addText(citeText, {
      x: MARGIN.left, y: SLIDE_H - 0.32, w: CONTENT_W, h: 0.26,
      fontSize: FS.micro, fontFace: FONT, color: C.darkGray, align: "right", valign: "middle",
    });
  }
  return slide;
}

function renderNestedLayers(pres: Pres, s: DeckSlide): Slide {
  const v = vis(s);
  const slide = addContentSlide(pres, s.title);
  addNotes(slide, s);

  const eyebrow = v.eyebrow as string | undefined;
  if (eyebrow) {
    slide.addText(eyebrow, {
      x: SLIDE_W - MARGIN.right - 3.4, y: 0.32, w: 3.4, h: 0.45,
      fontSize: FS.small, fontFace: FONT, color: C.midGray, align: "right", valign: "middle",
    });
  }

  const outer = v.outer as { label: string; desc: string; tag?: string };
  const inner = v.inner as { label: string; desc: string; tag?: string };

  const badge = (x: number, y: number, text: string, fill: string) => {
    const w = 1.35, h = 0.42;
    slide.addShape(pres.ShapeType.rect, { x, y, w, h, fill: { color: fill }, rectRadius: 0.08 });
    slide.addText(text, {
      x, y, w, h, fontSize: FS.micro, fontFace: FONT, color: C.white, bold: true,
      align: "center", valign: "middle",
    });
    return w;
  };

  // 外側＝再現可能性（到達点）
  const oX = 1.15, oY = 1.5, oW = SLIDE_W - 2 * 1.15, oH = 4.35;
  slide.addShape(pres.ShapeType.rect, {
    x: oX, y: oY, w: oW, h: oH,
    fill: { color: C.lightGray }, line: { color: C.primary, width: 2.25 }, rectRadius: 0.1,
  });
  const obw = outer.tag ? badge(oX + 0.4, oY + 0.32, outer.tag, C.primary) : 0;
  slide.addText(outer.label, {
    x: oX + 0.4 + (obw ? obw + 0.25 : 0), y: oY + 0.26, w: 6, h: 0.55,
    fontSize: FS.heading, fontFace: FONT, color: C.primary, bold: true,
    align: "left", valign: "middle",
  });
  slide.addText(outer.desc, {
    x: oX + 0.45, y: oY + 0.9, w: oW - 0.9, h: 0.55,
    fontSize: FS.small, fontFace: FONT, color: C.text, align: "left", valign: "middle", wrap: true,
  });

  // 内側＝開示（最低限）
  const iW = 7.4, iX = (SLIDE_W - iW) / 2, iY = 3.0, iH = 2.4;
  slide.addShape(pres.ShapeType.rect, {
    x: iX, y: iY, w: iW, h: iH,
    fill: { color: C.white }, line: { color: C.accent, width: 2.25 }, rectRadius: 0.1,
    shadow: { type: "outer", blur: 5, offset: 2, angle: 90, color: "000000", opacity: 0.15 },
  });
  if (inner.tag) badge(iX + 0.4, iY + 0.3, inner.tag, C.accent);
  slide.addText(inner.label, {
    x: iX, y: iY + 0.3, w: iW, h: 0.5,
    fontSize: FS.heading, fontFace: FONT, color: C.accent, bold: true,
    align: "center", valign: "middle",
  });
  slide.addText(inner.desc, {
    x: iX + 0.5, y: iY + 1.0, w: iW - 1.0, h: 1.1,
    fontSize: FS.small, fontFace: FONT, color: C.text,
    align: "center", valign: "middle", wrap: true,
  });

  // 注記（外枠の下）
  if (v.note) {
    slide.addText(v.note as string, {
      x: oX, y: oY + oH + 0.18, w: oW, h: 0.55,
      fontSize: FS.body, fontFace: FONT, color: C.primary, bold: true,
      align: "center", valign: "middle", wrap: true,
    });
  }

  const citeText = (v.cites as string[] | undefined)?.map((k) => cite(k)).filter(Boolean).join("; ")
    ?? cite(v.cite as string);
  if (citeText) {
    slide.addText(citeText, {
      x: MARGIN.left, y: SLIDE_H - 0.32, w: CONTENT_W, h: 0.26,
      fontSize: FS.micro, fontFace: FONT, color: C.darkGray, align: "right", valign: "middle",
    });
  }
  return slide;
}

function renderAgentLoop(pres: Pres, s: DeckSlide): Slide {
  const v = vis(s);
  const slide = addContentSlide(pres, s.title);
  addNotes(slide, s);

  const eyebrow = v.eyebrow as string | undefined;
  if (eyebrow) {
    slide.addText(eyebrow, {
      x: SLIDE_W - MARGIN.right - 3.4, y: 0.32, w: 3.4, h: 0.45,
      fontSize: FS.small, fontFace: FONT, color: C.midGray, align: "right", valign: "middle",
    });
  }

  const input = v.input as { label: string; example: string; icon?: string };
  const output = v.output as { label: string; items: string[]; icon?: string };
  const steps = (v.steps as Array<{ icon?: string; name: string; body: string }>) ?? [];
  const hub = v.hub as string | undefined;
  const hubSub = v.hub_sub as string | undefined;
  const loopLabel = (v.loop_label as string) ?? "足りなければ繰り返す";

  // ── 横幅・高さの割り付け（input | ①②③ | output） ──
  // 入力・ステップ・出力の3カラムを同一高さ・同一上下端にそろえる（上端 rowY・下端 rowY+cardH）。
  // 入力／出力カードは左右対称（同幅・左右マージン同値）。中央3枚はその間に等間隔で配置。
  const rowY = 2.3;
  const cardH = 2.45;                               // 3カラム共通の高さ
  const stepH = cardH, inH = cardH, outH = cardH;
  const stepCY = rowY + cardH / 2;                 // 横矢印＝全カードの縦中心（高さ統一で一直線）
  const inX = MARGIN.left, inW = 2.25;
  const outW = 2.25, outX = SLIDE_W - MARGIN.right - outW;
  const stepGap = 0.34, sideGap = 0.4;
  const stepsX0 = inX + inW + sideGap;
  const stepsX1 = outX - sideGap;
  const stepW = (stepsX1 - stepsX0 - stepGap * 2) / 3;
  const stepXs = [0, 1, 2].map((i) => stepsX0 + i * (stepW + stepGap));

  // 横向き矢印（midGray・三角・ステップ中心の高さ）
  const flowArrow = (x: number, w: number) => {
    slide.addShape("rightArrow" as any, {
      x, y: stepCY - 0.18, w, h: 0.36,
      fill: { color: C.midGray }, line: { color: C.midGray },
    });
  };

  const stripH = 0.56;
  const headerStrip = (x: number, w: number, text: string, fill: string) => {
    slide.addShape(pres.ShapeType.rect, { x, y: rowY, w, h: stripH, fill: { color: fill } });
    slide.addText(text, {
      x: x + 0.06, y: rowY, w: w - 0.12, h: stripH, fontSize: FS.small, fontFace: FONT, color: C.white, bold: true,
      align: "center", valign: "middle",
    });
  };

  // ── 入力カード（人間の指示） ──
  slide.addShape(pres.ShapeType.rect, {
    x: inX, y: rowY, w: inW, h: inH,
    fill: { color: C.white }, line: { color: C.accent, width: 1.5 }, rectRadius: 0.08,
  });
  headerStrip(inX, inW, input.label, C.accent);
  addIcon(slide, input.icon ?? "comment-text-outline", inX + inW / 2 - 0.24, rowY + 0.66, 0.48, C.accent);
  slide.addText(input.example, {
    x: inX + 0.12, y: rowY + 1.22, w: inW - 0.24, h: inH - 1.32,
    fontSize: FS.micro, fontFace: FONT, color: C.text, align: "center", valign: "middle", wrap: true,
  });
  flowArrow(inX + inW + 0.02, sideGap - 0.06);

  // ── 中央：エージェントの繰り返し（①②③ を囲む帯＝AIエージェント） ──
  const bandY = rowY - 0.6;
  slide.addShape(pres.ShapeType.rect, {
    x: stepsX0 - 0.12, y: bandY, w: (stepsX1 - stepsX0) + 0.24, h: 0.5,
    fill: { color: C.primaryLight }, rectRadius: 0.08,
  });
  addIcon(slide, "robot-outline", stepsX0 + 0.04, bandY + 0.06, 0.38, C.white);
  slide.addText(
    [
      { text: (hub ?? "AIエージェント") + "　", options: { bold: true, fontSize: FS.small } },
      ...(hubSub ? [{ text: hubSub, options: { fontSize: FS.micro } }] : []),
    ] as any,
    {
      x: stepsX0 + 0.4, y: bandY, w: (stepsX1 - stepsX0) - 0.4, h: 0.5,
      fontFace: FONT, color: C.white, align: "center", valign: "middle",
    },
  );

  // ステップカード
  steps.slice(0, 3).forEach((st, i) => {
    const x = stepXs[i]!;
    slide.addShape(pres.ShapeType.rect, {
      x, y: rowY, w: stepW, h: stepH,
      fill: { color: C.white }, line: { color: C.primary, width: 1.25 }, rectRadius: 0.08,
    });
    // 連番バッジ
    slide.addShape(pres.ShapeType.ellipse, {
      x: x + 0.12, y: rowY + 0.12, w: 0.42, h: 0.42, fill: { color: C.primary },
    });
    slide.addText(`${i + 1}`, {
      x: x + 0.12, y: rowY + 0.12, w: 0.42, h: 0.42,
      fontSize: FS.small, fontFace: FONT_EN, color: C.white, bold: true,
      align: "center", valign: "middle",
    });
    if (st.icon) addIcon(slide, st.icon, x + stepW / 2 - 0.25, rowY + 0.52, 0.5, C.primary);
    slide.addText(st.name, {
      x: x + 0.1, y: rowY + 1.16, w: stepW - 0.2, h: 0.4,
      fontSize: FS.small, fontFace: FONT, color: C.primary, bold: true,
      align: "center", valign: "middle",
    });
    slide.addText(st.body, {
      x: x + 0.08, y: rowY + 1.6, w: stepW - 0.16, h: stepH - 1.7,
      fontSize: FS.micro, fontFace: FONT, color: C.text, align: "center", valign: "middle", wrap: true,
    });
    // ①→②, ②→③ の矢印
    if (i < 2) flowArrow(x + stepW + 0.02, stepGap - 0.04);
  });

  // ── 返り矢印（③→①の下を回って「繰り返す」） ──
  const stepsBottom = rowY + stepH;
  const retY = stepsBottom + 0.42;                 // 横の返り矢印の中心
  const leftMid = stepXs[0]! + stepW / 2;
  const rightMid = stepXs[2]! + stepW / 2;
  // ③ 下端から下へ
  slide.addShape(pres.ShapeType.line, {
    x: rightMid, y: stepsBottom, w: 0, h: retY - stepsBottom,
    line: { color: C.accent, width: 2 },
  });
  // 横向き（左へ）＋矢印
  slide.addShape("leftArrow" as any, {
    x: leftMid, y: retY - 0.2, w: rightMid - leftMid, h: 0.4,
    fill: { color: C.accent }, line: { color: C.accent },
  });
  // ① 下端へ「戻る」（矢じりは上向き＝①考えるの中へ刺す。beginArrowType で線の始点=上端に付ける）
  slide.addShape(pres.ShapeType.line, {
    x: leftMid, y: stepsBottom, w: 0, h: retY - 0.2 - stepsBottom,
    line: { color: C.accent, width: 2, beginArrowType: "triangle" } as any,
  });
  slide.addText(loopLabel, {
    x: stepsX0, y: retY + 0.22, w: stepsX1 - stepsX0, h: 0.4,
    fontSize: FS.small, fontFace: FONT, color: C.accent, bold: true,
    align: "center", valign: "middle",
  });

  // ── 出力カード（成果物が残る） ──
  flowArrow(stepsX1 + 0.02, sideGap - 0.06);
  slide.addShape(pres.ShapeType.rect, {
    x: outX, y: rowY, w: outW, h: outH,
    fill: { color: C.white }, line: { color: C.primary, width: 1.5 }, rectRadius: 0.08,
  });
  headerStrip(outX, outW, output.label, C.primary);
  const items = output.items ?? [];
  const itH = (outH - stripH - 0.16) / Math.max(items.length, 1);
  items.forEach((it, i) => {
    const iy = rowY + stripH + 0.12 + i * itH;
    addIcon(slide, output.icon ?? "file-document-outline", outX + 0.18, iy + itH / 2 - 0.15, 0.3, C.primary);
    slide.addText(it, {
      x: outX + 0.54, y: iy, w: outW - 0.66, h: itH,
      fontSize: FS.small, fontFace: FONT, color: C.text, align: "left", valign: "middle",
    });
  });

  // ── 下部：エージェントの位置づけ（チャット／手順との違い） ──
  if (v.note) {
    const ny = 5.92, nh = 0.78, nx = 0.9, nw = SLIDE_W - 2 * nx;
    slide.addShape(pres.ShapeType.rect, {
      x: nx, y: ny, w: nw, h: nh,
      fill: { color: C.lightGray }, line: { color: C.primary, width: 1.25 }, rectRadius: 0.08,
    });
    slide.addText(v.note as string, {
      x: nx + 0.35, y: ny, w: nw - 0.7, h: nh,
      fontSize: FS.small, fontFace: FONT, color: C.primary, bold: true,
      align: "center", valign: "middle", wrap: true,
    });
  }

  // 出典
  const citeText = (v.cites as string[] | undefined)?.map((k) => cite(k)).filter(Boolean).join("; ")
    ?? cite(v.cite as string);
  if (citeText) {
    slide.addText(citeText, {
      x: MARGIN.left, y: SLIDE_H - 0.52, w: CONTENT_W, h: 0.24,
      fontSize: FS.micro, fontFace: FONT, color: C.darkGray, align: "right", valign: "middle",
    });
  }
  return slide;
}
