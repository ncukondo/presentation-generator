/**
 * Loads slide content and narration from slides.yaml.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { parse } from "yaml";

export interface SlideData {
  id: string;
  title: string;
  /** Which renderer to dispatch to (data-driven mode; see lib/render.ts). */
  layout?: string;
  /** Layout-specific parameters consumed by the renderer. */
  visual?: Record<string, unknown>;
  /** TTS / 動画の読み上げ原稿。指定時は PowerPoint ノートにも入る（省略可）。 */
  narration?: string;
  /** PowerPoint ノート専用メモ。TTS/動画では読み上げない。`narration` より優先（省略可）。 */
  notes?: string;
  [key: string]: unknown;
}

const raw = readFileSync(join(import.meta.dir, "../slides.yaml"), "utf-8");
const doc = parse(raw) as { slides: SlideData[]; theme?: Record<string, unknown> };

// Structural validation — catches yaml shape mismatches (wrong types,
// missing required fields) before they surface as cryptic errors inside pptxgenjs.
// Placeholder text ("ここに記載" etc.) is reported as a warning, not an error.
import { validateSlidesOrThrow } from "./validate";
import { validateThemeBlock } from "./themes";
validateSlidesOrThrow(doc.slides);

// Theme block is optional; report (don't throw) on unknown preset / bad hex.
const themeWarnings = validateThemeBlock(doc.theme);
if (themeWarnings.length) {
  console.warn(`[theme] ${themeWarnings.length} warning(s):`);
  for (const w of themeWarnings) console.warn(`  ⚠ ${w}`);
}

/** The raw `theme:` block from slides.yaml (undefined if not present). */
export function getTheme(): Record<string, unknown> | undefined {
  return doc.theme;
}

export function getSlide(id: string): SlideData {
  const s = doc.slides.find((s) => s.id === id);
  if (!s) throw new Error(`Slide "${id}" not found in slides.yaml`);
  return s;
}

export function getAllSlides(): SlideData[] {
  return doc.slides;
}
