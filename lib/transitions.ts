/**
 * Slide transitions (morph / fade / push / wipe) — a post-processing layer.
 *
 * PptxGenJS has no transition API, so `generate.ts` renders the deck to an
 * in-memory PPTX and `lib/postprocess.ts` injects a `<p:transition>` element
 * (built here) into each `ppt/slides/slideN.xml` that declares one.
 *
 * Declaration (slides.yaml):
 *
 *   defaults:
 *     transition: fade              # deck-wide default (optional)
 *   slides:
 *     - id: x
 *       transition: morph           # short form
 *     - id: y
 *       transition:                 # long form
 *         type: morph               # none / morph / fade / push / wipe
 *         option: byObject          # morph only: byObject / byWord / byChar
 *         direction: left           # push / wipe only: left / right / up / down
 *         duration: 1.0             # seconds
 *
 * A transition belongs to the slide it *enters* (PowerPoint semantics).
 *
 * Morph pairing: PowerPoint matches shapes across consecutive slides by
 * heuristics, unless a shape name starts with `!!` — then shapes with the same
 * name are always paired. `morphName` / `morphOpt` turn a YAML `key` into that
 * name (`!!key`, `!!key.part`) so renderers can opt elements in.
 *
 * XML is written the way PowerPoint itself writes it: wrapped in
 * `mc:AlternateContent`, so apps that don't know the p14/p159 namespaces fall
 * back to a plain transition (fade for morph).
 */
// ── Spec ─────────────────────────────────────────────────
export const TRANSITION_TYPES = ["none", "morph", "fade", "push", "wipe"] as const;
export type TransitionType = (typeof TRANSITION_TYPES)[number];

export const MORPH_OPTIONS = ["byObject", "byWord", "byChar"] as const;
export type MorphOption = (typeof MORPH_OPTIONS)[number];

export const DIRECTIONS = ["left", "right", "up", "down"] as const;
export type Direction = (typeof DIRECTIONS)[number];

export interface TransitionSpec {
  type: TransitionType;
  /** morph only */
  option?: MorphOption;
  /** push / wipe only */
  direction?: Direction;
  /** seconds */
  duration?: number;
}

/** Default duration (seconds) per type when `duration` is omitted. */
export const DEFAULT_DURATION: Record<TransitionType, number> = {
  none: 0,
  morph: 1.0,
  fade: 0.5,
  push: 0.5,
  wipe: 0.5,
};

// ── Parsing / validation ─────────────────────────────────
export interface ParsedTransition {
  spec?: TransitionSpec;
  errors: string[];
  warnings: string[];
}

const KNOWN_KEYS = new Set(["type", "option", "direction", "duration"]);

/**
 * Parse a raw `transition` value (string or object). `undefined` / `null`
 * means "not declared" (spec undefined, no errors).
 */
export function parseTransition(path: string, raw: unknown): ParsedTransition {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (raw === undefined || raw === null) return { errors, warnings };

  const typeList = TRANSITION_TYPES.join(" / ");
  if (typeof raw === "string") {
    if (!isType(raw)) {
      errors.push(`${path}: unknown transition "${raw}" (expected ${typeList})`);
      return { errors, warnings };
    }
    return { spec: { type: raw }, errors, warnings };
  }

  if (typeof raw !== "object" || Array.isArray(raw)) {
    errors.push(`${path}: expected string or object, got ${Array.isArray(raw) ? "array" : typeof raw}`);
    return { errors, warnings };
  }

  const obj = raw as Record<string, unknown>;
  const type = obj.type;
  if (typeof type !== "string" || !isType(type)) {
    errors.push(`${path}.type: expected one of ${typeList}, got ${JSON.stringify(type)}`);
    return { errors, warnings };
  }
  const spec: TransitionSpec = { type };

  for (const k of Object.keys(obj)) {
    if (!KNOWN_KEYS.has(k)) warnings.push(`${path}.${k}: unknown field (ignored)`);
  }

  if (obj.option !== undefined) {
    if (type !== "morph") {
      warnings.push(`${path}.option: only meaningful for type "morph" (ignored for "${type}")`);
    } else if (typeof obj.option !== "string" || !MORPH_OPTIONS.includes(obj.option as MorphOption)) {
      errors.push(`${path}.option: expected ${MORPH_OPTIONS.join(" / ")}, got ${JSON.stringify(obj.option)}`);
    } else {
      spec.option = obj.option as MorphOption;
    }
  }

  if (obj.direction !== undefined) {
    if (type !== "push" && type !== "wipe") {
      warnings.push(`${path}.direction: only meaningful for type "push" / "wipe" (ignored for "${type}")`);
    } else if (typeof obj.direction !== "string" || !DIRECTIONS.includes(obj.direction as Direction)) {
      errors.push(`${path}.direction: expected ${DIRECTIONS.join(" / ")}, got ${JSON.stringify(obj.direction)}`);
    } else {
      spec.direction = obj.direction as Direction;
    }
  }

  if (obj.duration !== undefined) {
    if (typeof obj.duration !== "number" || !(obj.duration > 0) || !Number.isFinite(obj.duration)) {
      errors.push(`${path}.duration: expected a positive number of seconds, got ${JSON.stringify(obj.duration)}`);
    } else {
      spec.duration = obj.duration;
    }
  }

  return { spec, errors, warnings };
}

function isType(v: string): v is TransitionType {
  return (TRANSITION_TYPES as readonly string[]).includes(v);
}

/**
 * Resolve the effective transition for one slide: the slide's own declaration
 * wins over the deck default. Returns undefined when nothing should be
 * emitted (not declared anywhere, or resolved to `none`).
 * Inputs are assumed to have passed `parseTransition` already.
 */
export function resolveTransition(slideRaw: unknown, defaultRaw: unknown): TransitionSpec | undefined {
  const own = parseTransition("slide.transition", slideRaw).spec;
  const spec = own ?? parseTransition("defaults.transition", defaultRaw).spec;
  if (!spec || spec.type === "none") return undefined;
  return spec;
}

// ── XML ──────────────────────────────────────────────────
const NS_MC = "http://schemas.openxmlformats.org/markup-compatibility/2006";
const NS_P14 = "http://schemas.microsoft.com/office/powerpoint/2010/main";
// morph lives in the 2015/**09** namespace ([MS-PPTX] 2.3.x "morph"). Not 2015/10 —
// that is a different namespace (p1510) and PowerPoint silently drops the effect.
export const NS_P159 = "http://schemas.microsoft.com/office/powerpoint/2015/09/main";

/** Legacy `spd` attribute (pre-2010 readers): fast≈0.5s, med≈0.75s, slow≈1s. */
function spdFor(seconds: number): "fast" | "med" | "slow" {
  if (seconds <= 0.5) return "fast";
  if (seconds <= 0.75) return "med";
  return "slow";
}

const DIR_ATTR: Record<Direction, string> = { left: "l", right: "r", up: "u", down: "d" };

/**
 * `<p:transition>` markup for a spec, wrapped in `mc:AlternateContent` exactly
 * as PowerPoint writes it. Empty string for `none`.
 */
export function transitionXml(spec: TransitionSpec): string {
  if (spec.type === "none") return "";
  const seconds = spec.duration ?? DEFAULT_DURATION[spec.type];
  const ms = Math.round(seconds * 1000);
  const spd = spdFor(seconds);

  let requires: "p14" | "p159";
  let effect: string;
  let fallback: string;
  switch (spec.type) {
    case "morph":
      requires = "p159";
      effect = `<p159:morph option="${spec.option ?? "byObject"}"/>`;
      fallback = "<p:fade/>";
      break;
    case "fade":
      requires = "p14";
      effect = fallback = "<p:fade/>";
      break;
    case "push":
      requires = "p14";
      effect = fallback = `<p:push dir="${DIR_ATTR[spec.direction ?? "left"]}"/>`;
      break;
    case "wipe":
      requires = "p14";
      effect = fallback = `<p:wipe dir="${DIR_ATTR[spec.direction ?? "left"]}"/>`;
      break;
  }

  // Prefixes named in `Requires` must be in scope at the <mc:Choice>, so both
  // namespaces are declared on the wrapper.
  return (
    `<mc:AlternateContent xmlns:mc="${NS_MC}" xmlns:p14="${NS_P14}" xmlns:p159="${NS_P159}">` +
      `<mc:Choice Requires="${requires}">` +
        `<p:transition spd="${spd}" p14:dur="${ms}">${effect}</p:transition>` +
      `</mc:Choice>` +
      `<mc:Fallback>` +
        `<p:transition spd="${spd}">${fallback}</p:transition>` +
      `</mc:Fallback>` +
    `</mc:AlternateContent>`
  );
}

/**
 * Insert a transition into one slide's XML. Element order in CT_Slide is
 * cSld, clrMapOvr, transition, timing, extLst — so the markup goes after
 * `</p:clrMapOvr>` (or `</p:cSld>` when there is no clrMapOvr) and before any
 * `<p:timing>` / `<p:extLst>` that follows.
 */
export function injectTransitionXml(slideXml: string, spec: TransitionSpec): string {
  const xml = transitionXml(spec);
  if (!xml) return slideXml;

  const cSldEnd = slideXml.indexOf("</p:cSld>");
  if (cSldEnd < 0) throw new Error("[transition] slide XML has no </p:cSld>");
  const tail = slideXml.slice(cSldEnd);
  if (tail.includes("<p:transition")) throw new Error("[transition] slide already has a <p:transition>");

  // Insertion point: right after <p:clrMapOvr> (self-closing or paired) if
  // present, else right after </p:cSld>.
  let at: number;
  const clrMap = /<p:clrMapOvr\b[^>]*\/>|<p:clrMapOvr\b[\s\S]*?<\/p:clrMapOvr>/.exec(tail);
  if (clrMap) at = cSldEnd + clrMap.index + clrMap[0].length;
  else at = cSldEnd + "</p:cSld>".length;

  // But never after <p:timing> / <p:extLst> if either sits before that point
  // (defensive — PptxGenJS emits neither on slides today).
  for (const tag of ["<p:timing", "<p:extLst"]) {
    const i = tail.indexOf(tag);
    if (i >= 0 && cSldEnd + i < at) at = cSldEnd + i;
  }

  return slideXml.slice(0, at) + xml + slideXml.slice(at);
}

// ── Morph pairing names ──────────────────────────────────
/** PowerPoint pairs shapes whose names start with this prefix by exact name. */
export const MORPH_PREFIX = "!!";

/** Allowed `key` syntax (kept simple: `.` is reserved as the part separator). */
export const MORPH_KEY_RE = /^[A-Za-z0-9_-]+$/;

/** Names used by the shared chrome (`addContentSlide` etc.); not available as `key`. */
export const RESERVED_MORPH_KEYS = ["bg", "titlebar", "title", "rule"] as const;

/** `!!key` or `!!key.part` — the shape name PowerPoint uses for pairing. */
export function morphName(key: string, part?: string): string {
  return MORPH_PREFIX + key + (part ? `.${part}` : "");
}

/**
 * Spreadable option bag for PptxGenJS `add*` calls: `{ objectName }` when a
 * key is given, `{}` otherwise — so renderers can write
 * `slide.addShape(..., { ..., ...morphOpt(item.key, "bar") })`.
 */
export function morphOpt(key: string | undefined, part?: string): { objectName?: string } {
  return key ? { objectName: morphName(key, part) } : {};
}
