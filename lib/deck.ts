/**
 * Deck loader for the data-driven rendering mode.
 *
 * Reads slides.yaml (via slides-data) and returns the ordered list of slides,
 * each carrying a `layout` (which renderer to use) and a `visual` bag (the
 * layout-specific parameters). `generate.ts` loops over this and dispatches to
 * `lib/render.ts` — there is no per-id wiring anywhere.
 *
 * This is the single seam where extra slides (e.g. an auto-generated references
 * slide or an appendix) could be concatenated in the future. For now it returns
 * the YAML order verbatim; the references slide is an explicit entry in the YAML.
 */
import { getAllSlides, type SlideData } from "./slides-data";

export interface DeckSlide extends SlideData {
  /** Which renderer to dispatch to (see lib/render.ts). */
  layout: string;
  /** Layout-specific parameters. */
  visual?: Record<string, unknown>;
}

/** Ordered deck of slides as declared in slides.yaml. */
export function getDeck(): DeckSlide[] {
  return getAllSlides() as DeckSlide[];
}
