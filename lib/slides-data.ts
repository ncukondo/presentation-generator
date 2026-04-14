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
const doc = parse(raw) as { slides: SlideData[] };

// Structural validation — catches yaml shape mismatches (wrong types,
// missing required fields) before they surface as cryptic errors inside pptxgenjs.
// Placeholder text ("ここに記載" etc.) is reported as a warning, not an error.
import { validateSlidesOrThrow } from "./validate";
validateSlidesOrThrow(doc.slides);

export function getSlide(id: string): SlideData {
  const s = doc.slides.find((s) => s.id === id);
  if (!s) throw new Error(`Slide "${id}" not found in slides.yaml`);
  return s;
}

export function getAllSlides(): SlideData[] {
  return doc.slides;
}
