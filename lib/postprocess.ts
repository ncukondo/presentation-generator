/**
 * PPTX post-processing — everything PptxGenJS cannot express, injected into
 * the slide XML right before the file is written.
 *
 *   1. duplicate `cNvPr id` repair   (PptxGenJS occasionally emits clashes)
 *   2. slide transitions              (`lib/transitions.ts`; morph / fade / …)
 *   3. media playback timing          (auto-play + loop for embedded video)
 *
 * `generate.ts` renders the deck to a Buffer, builds one `SlidePostSpec` per
 * rendered slide (keyed by 1-based slide number = `ppt/slides/slideN.xml`),
 * and calls `postProcessPptx`. Every step is a pure string → string function
 * on one slide's XML so it can be unit-tested without a zip.
 *
 * Media playback: renderers call `requestMediaPlayback(slide, {...})` right
 * after `slide.addMedia({... objectName})`; `generate.ts` collects those
 * requests per slide with `takeMediaPlayback`. The timing XML mirrors what
 * PowerPoint itself writes for "Start: Automatically" + "Loop until Stopped"
 * (a `playFrom(0.0)` withEffect in the main sequence, plus a `cMediaNode`
 * with `repeatCount="indefinite"`).
 */
import JSZip from "jszip";
import type { Slide } from "./types";
import { injectTransitionXml, type TransitionSpec } from "./transitions";

// ── Specs ────────────────────────────────────────────────
export interface MediaPlayback {
  /** `objectName` given to `addMedia` — used to find the `<p:pic>` in the XML. */
  name: string;
  /** Start playing when the slide is shown (WithPrevious). */
  autoplay: boolean;
  /** Loop until the slide is left. */
  loop: boolean;
}

export interface SlidePostSpec {
  transition?: TransitionSpec;
  media?: MediaPlayback[];
}

// ── Per-slide media registry (renderer → generate.ts) ────
const mediaRequests = new WeakMap<object, MediaPlayback[]>();

/** Called by a renderer after `slide.addMedia({..., objectName: req.name})`. */
export function requestMediaPlayback(slide: Slide, req: MediaPlayback): void {
  const list = mediaRequests.get(slide) ?? [];
  list.push(req);
  mediaRequests.set(slide, list);
}

/** Drain the requests registered for a slide (empty array if none). */
export function takeMediaPlayback(slide: Slide): MediaPlayback[] {
  const list = mediaRequests.get(slide) ?? [];
  mediaRequests.delete(slide);
  return list;
}

// ── 1. duplicate shape id repair ─────────────────────────
const CNVPR_RE = /<p:cNvPr\b([^>]*?)\bid="(\d+)"/g;

/** Character ranges of `<p:pic>` blocks that embed a video. */
function videoPicRanges(xml: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  for (const m of xml.matchAll(/<p:pic>[\s\S]*?<\/p:pic>/g)) {
    if (m[0].includes("<a:videoFile")) ranges.push([m.index, m.index + m[0].length]);
  }
  return ranges;
}

/**
 * Give every `<p:cNvPr>` a unique id. Video `<p:pic>` elements always keep
 * theirs (PptxGenJS ties that id to the media rId), the first other holder of
 * an id keeps it, and later duplicates get fresh ids above the current maximum.
 * Returns the (old → new) pairs that were changed (empty when nothing clashed).
 */
export function renumberDuplicateShapeIds(xml: string): { xml: string; changed: Array<[number, number]> } {
  const matches = [...xml.matchAll(CNVPR_RE)];
  const ranges = videoPicRanges(xml);
  const isVideo = (pos: number) => ranges.some(([a, b]) => pos >= a && pos < b);

  const taken = new Set<number>();
  for (const m of matches) if (isVideo(m.index)) taken.add(Number(m[2]));

  let next = Math.max(0, ...matches.map((m) => Number(m[2]))) + 1;
  const changed: Array<[number, number]> = [];
  let out = "";
  let cursor = 0;
  for (const m of matches) {
    const id = Number(m[2]);
    out += xml.slice(cursor, m.index);
    cursor = m.index + m[0].length;
    if (isVideo(m.index) || !taken.has(id)) {
      taken.add(id);
      out += m[0];
      continue;
    }
    const fresh = next++;
    changed.push([id, fresh]);
    out += `<p:cNvPr${m[1]}id="${fresh}"`;
  }
  out += xml.slice(cursor);
  return { xml: out, changed };
}

// ── 3. media playback timing ─────────────────────────────
function xmlAttr(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Find the shape id of the video `<p:pic>` whose cNvPr name matches. */
export function findMediaShapeId(xml: string, name: string): number | undefined {
  const needle = `name="${xmlAttr(name)}"`;
  for (const pic of xml.match(/<p:pic>[\s\S]*?<\/p:pic>/g) ?? []) {
    if (!pic.includes("<a:videoFile")) continue;
    const m = /<p:cNvPr\b([^>]*?)\bid="(\d+)"([^>]*)>/.exec(pic);
    if (!m) continue;
    if (`${m[1] ?? ""}${m[3] ?? ""}`.includes(needle)) return Number(m[2]);
  }
  return undefined;
}

const SLD_TGT = '<p:tgtEl><p:sldTgt/></p:tgtEl>';

/**
 * `<p:timing>` markup for the given media shapes. Shapes with `autoplay` get a
 * `playFrom(0.0)` withEffect in the main sequence; every shape gets a
 * `cMediaNode` (looping when `loop`). Returns "" when nothing is requested.
 */
export function mediaTimingXml(items: Array<{ spid: number; autoplay: boolean; loop: boolean }>): string {
  const active = items.filter((it) => it.autoplay || it.loop);
  if (active.length === 0) return "";
  let id = 1;
  const nextId = () => id++;

  const rootId = nextId();     // 1: tmRoot
  const mainSeqId = nextId();  // 2: mainSeq

  // Main sequence: one "click group" started automatically (onBegin of mainSeq)
  // holding a withEffect playFrom for each auto-playing video.
  const autoItems = active.filter((it) => it.autoplay);
  let seq = "";
  if (autoItems.length) {
    const groupId = nextId();
    const parId = nextId();
    const effects = autoItems.map((it) => {
      const effId = nextId();
      const bhvId = nextId();
      return (
        `<p:par><p:cTn id="${effId}" presetID="1" presetClass="mediacall" presetSubtype="0" fill="hold" nodeType="withEffect">` +
          `<p:stCondLst><p:cond delay="0"/></p:stCondLst>` +
          `<p:childTnLst><p:cmd type="call" cmd="playFrom(0.0)"><p:cBhvr>` +
            `<p:cTn id="${bhvId}" dur="1" fill="hold"/>` +
            `<p:tgtEl><p:spTgt spid="${it.spid}"/></p:tgtEl>` +
          `</p:cBhvr></p:cmd></p:childTnLst>` +
        `</p:cTn></p:par>`
      );
    }).join("");
    seq =
      `<p:seq concurrent="1" nextAc="seek">` +
        `<p:cTn id="${mainSeqId}" dur="indefinite" nodeType="mainSeq"><p:childTnLst>` +
          `<p:par><p:cTn id="${groupId}" fill="hold">` +
            `<p:stCondLst><p:cond delay="indefinite"/><p:cond evt="onBegin" delay="0"><p:tn val="${mainSeqId}"/></p:cond></p:stCondLst>` +
            `<p:childTnLst><p:par><p:cTn id="${parId}" fill="hold">` +
              `<p:stCondLst><p:cond delay="0"/></p:stCondLst>` +
              `<p:childTnLst>${effects}</p:childTnLst>` +
            `</p:cTn></p:par></p:childTnLst>` +
          `</p:cTn></p:par>` +
        `</p:childTnLst></p:cTn>` +
        `<p:prevCondLst><p:cond evt="onPrev" delay="0">${SLD_TGT}</p:cond></p:prevCondLst>` +
        `<p:nextCondLst><p:cond evt="onNext" delay="0">${SLD_TGT}</p:cond></p:nextCondLst>` +
      `</p:seq>`;
  }

  // One media node per video; repeatCount="indefinite" = "Loop until Stopped".
  const videos = active.map((it) => {
    const nodeId = nextId();
    const repeat = it.loop ? ' repeatCount="indefinite"' : "";
    return (
      `<p:video><p:cMediaNode vol="80000">` +
        `<p:cTn id="${nodeId}"${repeat} fill="hold" display="0">` +
          `<p:stCondLst><p:cond delay="indefinite"/></p:stCondLst>` +
          `<p:endCondLst><p:cond evt="onNext" delay="0">${SLD_TGT}</p:cond></p:endCondLst>` +
        `</p:cTn>` +
        `<p:tgtEl><p:spTgt spid="${it.spid}"/></p:tgtEl>` +
      `</p:cMediaNode></p:video>`
    );
  }).join("");

  return (
    `<p:timing><p:tnLst><p:par>` +
      `<p:cTn id="${rootId}" dur="indefinite" restart="never" nodeType="tmRoot">` +
        `<p:childTnLst>${seq}${videos}</p:childTnLst>` +
      `</p:cTn>` +
    `</p:par></p:tnLst></p:timing>`
  );
}

/**
 * Insert media playback timing into one slide's XML. Element order in CT_Slide
 * is cSld, clrMapOvr, transition, timing, extLst — so it goes right before a
 * slide-level `<p:extLst>` if there is one, else right before `</p:sld>`.
 */
export function injectMediaTiming(slideXml: string, media: MediaPlayback[]): string {
  const items = media.map((m) => {
    const spid = findMediaShapeId(slideXml, m.name);
    if (spid === undefined) throw new Error(`[media] video shape "${m.name}" not found in slide XML`);
    return { spid, autoplay: m.autoplay, loop: m.loop };
  });
  const xml = mediaTimingXml(items);
  if (!xml) return slideXml;

  const cSldEnd = slideXml.indexOf("</p:cSld>");
  if (cSldEnd < 0) throw new Error("[media] slide XML has no </p:cSld>");
  const tail = slideXml.slice(cSldEnd);
  if (tail.includes("<p:timing")) throw new Error("[media] slide already has a <p:timing>");

  const extLst = tail.indexOf("<p:extLst");
  const end = tail.lastIndexOf("</p:sld>");
  const at = cSldEnd + (extLst >= 0 && extLst < end ? extLst : end);
  return slideXml.slice(0, at) + xml + slideXml.slice(at);
}

// ── Orchestration ────────────────────────────────────────
export interface SlideProcessResult {
  xml: string;
  renumbered: Array<[number, number]>;
}

/** Apply every step to one slide's XML (pure). */
export function processSlideXml(xml: string, spec: SlidePostSpec): SlideProcessResult {
  // Ids first — timing references them, and clashes would make the target ambiguous.
  const fixed = renumberDuplicateShapeIds(xml);
  let out = fixed.xml;
  if (spec.transition) out = injectTransitionXml(out, spec.transition);
  if (spec.media?.length) out = injectMediaTiming(out, spec.media);
  return { xml: out, renumbered: fixed.changed };
}

export interface PostProcessSummary {
  transitions: number;
  mediaSlides: number;
  renumberedSlides: number[];
}

/**
 * Open a rendered PPTX (zip bytes), post-process every slide that has a spec
 * (plus id repair on all slides), and return the new zip + a summary.
 */
export async function postProcessPptx(
  pptx: Uint8Array | ArrayBuffer,
  specs: ReadonlyMap<number, SlidePostSpec>,
): Promise<{ data: Buffer; summary: PostProcessSummary }> {
  const zip = await JSZip.loadAsync(pptx);
  const summary: PostProcessSummary = { transitions: 0, mediaSlides: 0, renumberedSlides: [] };

  const slideFiles = Object.keys(zip.files)
    .map((f) => /^ppt\/slides\/slide(\d+)\.xml$/.exec(f))
    .filter((m): m is RegExpExecArray => !!m)
    .map((m) => ({ path: m[0], n: Number(m[1]) }));

  for (const [n] of specs) {
    if (!slideFiles.some((f) => f.n === n)) {
      throw new Error(`[postprocess] ppt/slides/slide${n}.xml not found in PPTX`);
    }
  }

  for (const { path, n } of slideFiles) {
    const spec = specs.get(n) ?? {};
    const src = await zip.file(path)!.async("string");
    const { xml, renumbered } = processSlideXml(src, spec);
    if (xml === src) continue;
    zip.file(path, xml);
    if (spec.transition && spec.transition.type !== "none") summary.transitions++;
    if (spec.media?.some((m) => m.autoplay || m.loop)) summary.mediaSlides++;
    if (renumbered.length) summary.renumberedSlides.push(n);
  }

  const data = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return { data, summary };
}
