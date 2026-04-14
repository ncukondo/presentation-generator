/**
 * Runtime validation for slides.yaml.
 * Catches shape mismatches early with clear, targeted error messages
 * instead of cryptic deep-call-stack TypeErrors inside pptxgenjs.
 *
 * Each slide id has a schema below. Unknown ids are ignored (forward-compatible).
 */

import type { SlideData } from "./slides-data";

type FieldKind =
  | { t: "string"; optional?: boolean }
  | { t: "string[]"; optional?: boolean }
  | { t: "object"; optional?: boolean; fields: Record<string, FieldKind> }
  | { t: "object[]"; optional?: boolean; fields: Record<string, FieldKind> };

type Schema = Record<string, FieldKind>;

const PLACEHOLDER_RE = /(ここに記載|ここに記入|をここに|TODO|xxxx|lorem ipsum)/i;

function checkField(path: string, value: unknown, kind: FieldKind, errors: string[], warnings: string[]) {
  const missing = value === undefined || value === null;
  if (missing) {
    if (!kind.optional) errors.push(`${path}: missing (expected ${kind.t})`);
    return;
  }
  switch (kind.t) {
    case "string":
      if (typeof value !== "string") {
        errors.push(`${path}: expected string, got ${describe(value)}`);
      } else if (PLACEHOLDER_RE.test(value)) {
        warnings.push(`${path}: placeholder text detected ("${truncate(value)}")`);
      }
      return;
    case "string[]":
      if (!Array.isArray(value)) {
        errors.push(`${path}: expected array, got ${describe(value)}`);
        return;
      }
      value.forEach((v, i) => {
        if (typeof v !== "string") {
          errors.push(`${path}[${i}]: expected string, got ${describe(v)}`);
        } else if (PLACEHOLDER_RE.test(v)) {
          warnings.push(`${path}[${i}]: placeholder text detected ("${truncate(v)}")`);
        }
      });
      return;
    case "object":
      if (typeof value !== "object" || Array.isArray(value)) {
        errors.push(`${path}: expected object, got ${describe(value)}`);
        return;
      }
      for (const [k, sub] of Object.entries(kind.fields)) {
        checkField(`${path}.${k}`, (value as Record<string, unknown>)[k], sub, errors, warnings);
      }
      return;
    case "object[]":
      if (!Array.isArray(value)) {
        errors.push(`${path}: expected array, got ${describe(value)}`);
        return;
      }
      value.forEach((v, i) => {
        if (typeof v !== "object" || v === null || Array.isArray(v)) {
          errors.push(`${path}[${i}]: expected object, got ${describe(v)}`);
          return;
        }
        for (const [k, sub] of Object.entries(kind.fields)) {
          checkField(`${path}[${i}].${k}`, (v as Record<string, unknown>)[k], sub, errors, warnings);
        }
      });
      return;
  }
}

function describe(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  if (typeof v === "object") {
    const keys = Object.keys(v as object);
    return `object{${keys.slice(0, 3).join(",")}${keys.length > 3 ? ",..." : ""}}`;
  }
  return typeof v;
}

function truncate(s: string): string {
  return s.length > 30 ? s.slice(0, 30) + "…" : s;
}

// ── Schemas per slide id ──────────────────────────────────
const CITE_ARR: FieldKind = { t: "string[]", optional: true };

const SCHEMAS: Record<string, Schema> = {
  title: {
    title: { t: "string" },
    subtitle: { t: "string" },
    presenter: { t: "string" },
  },
  background: {
    title: { t: "string" },
    subtitle: { t: "string" },
    cards: {
      t: "object[]",
      fields: {
        heading: { t: "string" },
        body: { t: "string" },
        detail: { t: "string", optional: true },
        cites: CITE_ARR,
      },
    },
  },
  notebooklm: {
    title: { t: "string" },
    subtitle: { t: "string" },
    features: { t: "string[]" },
    evidence_heading: { t: "string" },
    evidence: {
      t: "object[]",
      fields: {
        heading: { t: "string" },
        body: { t: "string" },
        cite: { t: "string", optional: true },
      },
    },
    url: { t: "string", optional: true },
  },
  "steps-overview": {
    title: { t: "string" },
    subtitle: { t: "string", optional: true },
    steps: { t: "string[]" },
    note: { t: "string", optional: true },
  },
  risks: {
    title: { t: "string" },
    risks_heading: { t: "string" },
    risks: {
      t: "object[]",
      fields: {
        heading: { t: "string" },
        body: { t: "string" },
        cites: CITE_ARR,
      },
    },
    solutions_heading: { t: "string" },
    solutions: {
      t: "object[]",
      fields: {
        heading: { t: "string" },
        body: { t: "string" },
        cites: CITE_ARR,
      },
    },
    banner: { t: "string", optional: true },
  },
  preparation: {
    title: { t: "string" },
    subtitle: { t: "string", optional: true },
    items: {
      t: "object[]",
      fields: {
        title: { t: "string" },
        desc: { t: "string" },
        url: { t: "string", optional: true },
        warning: { t: "string", optional: true },
      },
    },
  },
  closing: {
    title: { t: "string" },
    timeline: {
      t: "object[]",
      fields: {
        time: { t: "string" },
        duration: { t: "string" },
        desc: { t: "string" },
      },
    },
    closing_message: { t: "string" },
    closing_sub: { t: "string", optional: true },
    conference: { t: "string", optional: true },
  },
  references: {
    title: { t: "string" },
  },
};

// step-1 .. step-7 share the same schema
for (let i = 1; i <= 7; i++) {
  SCHEMAS[`step-${i}`] = {
    title: { t: "string" },
    screenshot: { t: "string" },
    note: { t: "string", optional: true },
  };
}

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

export function validateSlides(slides: SlideData[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();

  for (const slide of slides) {
    if (!slide.id) {
      errors.push("slide missing id");
      continue;
    }
    if (seen.has(slide.id)) errors.push(`duplicate slide id: ${slide.id}`);
    seen.add(slide.id);

    const schema = SCHEMAS[slide.id];
    if (!schema) continue; // unknown id — forward-compatible

    for (const [k, kind] of Object.entries(schema)) {
      checkField(`${slide.id}.${k}`, (slide as Record<string, unknown>)[k], kind, errors, warnings);
    }
  }
  return { errors, warnings };
}

/**
 * Validate slides and print a human-readable report.
 * Throws if any errors are present.
 */
export function validateSlidesOrThrow(slides: SlideData[]): void {
  const { errors, warnings } = validateSlides(slides);
  if (warnings.length) {
    console.warn(`[validate] ${warnings.length} warning(s):`);
    for (const w of warnings) console.warn(`  ⚠ ${w}`);
  }
  if (errors.length) {
    const msg = [`slides.yaml validation failed (${errors.length} error(s)):`, ...errors.map((e) => `  ✗ ${e}`)].join("\n");
    throw new Error(msg);
  }
}
