/**
 * Loads slide content and narration from slides.yaml.
 */
import { readFileSync } from "fs";
import { join } from "path";
import { parse } from "yaml";

export interface SlideData {
  id: string;
  title: string;
  narration?: string;
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
