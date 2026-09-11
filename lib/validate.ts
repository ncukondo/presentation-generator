/**
 * Runtime validation for slides.yaml (data-driven mode).
 * Catches shape mismatches early with clear, targeted error messages
 * instead of cryptic deep-call-stack TypeErrors inside pptxgenjs.
 *
 * Each slide declares a `layout`; its schema is keyed by layout below.
 * Top-level fields (e.g. `title`) and `visual.*` fields are checked separately.
 * Unknown layouts are ignored here (forward-compatible) — `lib/render.ts` will
 * throw at render time if a layout truly has no renderer.
 */

import type { SlideData, DeckDefaults } from "./slides-data";
import { parseTransition, MORPH_KEY_RE, RESERVED_MORPH_KEYS } from "./transitions";

type FieldKind =
  | { t: "string"; optional?: boolean }
  | { t: "number"; optional?: boolean }
  | { t: "boolean"; optional?: boolean }
  | { t: "string[]"; optional?: boolean }
  | { t: "object"; optional?: boolean; fields: Record<string, FieldKind> }
  | { t: "object[]"; optional?: boolean; fields: Record<string, FieldKind> }
  // 各要素が string か object のどちらでもよい配列（例: steps[] = string | {title, icon?}）
  | { t: "(string|object)[]"; optional?: boolean; fields: Record<string, FieldKind> };

type Schema = Record<string, FieldKind>;

/** Per-layout schema: top-level fields + fields nested under `visual`. */
interface LayoutSchema {
  top?: Schema;
  visual?: Schema;
}

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
    case "number":
      if (typeof value !== "number") {
        errors.push(`${path}: expected number, got ${describe(value)}`);
      }
      return;
    case "boolean":
      if (typeof value !== "boolean") {
        errors.push(`${path}: expected boolean (true/false), got ${describe(value)}`);
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
    case "(string|object)[]":
      if (!Array.isArray(value)) {
        errors.push(`${path}: expected array, got ${describe(value)}`);
        return;
      }
      value.forEach((v, i) => {
        if (typeof v === "string") {
          if (PLACEHOLDER_RE.test(v)) warnings.push(`${path}[${i}]: placeholder text detected ("${truncate(v)}")`);
        } else if (typeof v === "object" && v !== null && !Array.isArray(v)) {
          for (const [k, sub] of Object.entries(kind.fields)) {
            checkField(`${path}[${i}].${k}`, (v as Record<string, unknown>)[k], sub, errors, warnings);
          }
        } else {
          errors.push(`${path}[${i}]: expected string or object, got ${describe(v)}`);
        }
      });
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

// ── Schemas per layout ────────────────────────────────────
const CITE_ARR: FieldKind = { t: "string[]", optional: true };
// morph 対応付けキー（任意）。前後のスライドで同じ key を持つ要素が 1 つの図形として動く。
// 値の書式は checkMorphKeys で検査する（ここでは型だけ）。
const MORPH_KEY: FieldKind = { t: "string", optional: true };

const SCHEMAS: Record<string, LayoutSchema> = {
  title: {
    top: { title: { t: "string" } },
    visual: {
      // subtitle は任意（必須にすると題名の言い換えなど無意味な重複を誘発するため）
      subtitle: { t: "string", optional: true },
      presenter: { t: "string" },
    },
  },
  section: {
    top: { title: { t: "string" } },
    visual: {
      // number は文字列/数値どちらも許容するため宣言しない（render 側で String 化）
      eyebrow: { t: "string", optional: true },
      subtitle: { t: "string", optional: true },
      key: MORPH_KEY, // 章番号=.num / 題名=!!key。agenda の items[].key と揃えると目次の行が章扉へ飛ぶ
    },
  },
  evidence: {
    top: { title: { t: "string" } },
    visual: {
      // subtitle / evidence_heading は任意（重複誘発を避けるため非必須）
      subtitle: { t: "string", optional: true },
      features: { t: "string[]" },
      evidence_heading: { t: "string", optional: true },
      evidence: {
        t: "object[]",
        fields: {
          heading: { t: "string" },
          body: { t: "string" },
          cite: { t: "string", optional: true },
        },
      },
      figure: { t: "string", optional: true },
      figure_cite: { t: "string", optional: true },
      url: { t: "string", optional: true },
    },
  },
  steps: {
    top: { title: { t: "string" } },
    visual: {
      subtitle: { t: "string", optional: true },
      steps: { t: "(string|object)[]", fields: { title: { t: "string" }, icon: { t: "string", optional: true }, key: MORPH_KEY } },
      note: { t: "string", optional: true },
    },
  },
  "step-detail": {
    top: { title: { t: "string" } },
    visual: {
      step: { t: "number", optional: true },
      screenshot: { t: "string" },
      note: { t: "string", optional: true },
    },
  },
  risks: {
    top: { title: { t: "string" } },
    visual: {
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
          footnote: { t: "string", optional: true },
        },
      },
      banner: { t: "string", optional: true },
    },
  },
  checklist: {
    top: { title: { t: "string" } },
    visual: {
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
  },
  closing: {
    top: { title: { t: "string" } },
    visual: {
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
  },
  references: {
    top: { title: { t: "string" } },
  },
  statement: {
    top: { title: { t: "string", optional: true } },
    visual: {
      quote: { t: "string", optional: true },
      attribution: { t: "string", optional: true },
      eyebrow: { t: "string", optional: true },
    },
  },
  // number-cards は旧 `grid` を統合した「番号カード」唯一の layout。
  // items（or cards）2-4 件。subtitle/cites は grid 由来の任意フィールド。
  "number-cards": {
    top: { title: { t: "string" } },
    visual: {
      subtitle: { t: "string", optional: true },
      badge: { t: "string", optional: true }, // "number"(既定) | "none"（番号バッジ省略）
      items: {
        t: "object[]",
        optional: true,
        fields: {
          heading: { t: "string" },
          body: { t: "string" },
          detail: { t: "string", optional: true },
          footer: { t: "string", optional: true },
          cites: CITE_ARR,
          icon: { t: "string", optional: true }, // 指定時は番号をアイコンに差し替え
          key: MORPH_KEY,
        },
      },
      cards: {
        t: "object[]",
        optional: true,
        fields: {
          heading: { t: "string" },
          body: { t: "string" },
          detail: { t: "string", optional: true },
          footer: { t: "string", optional: true },
          cites: CITE_ARR,
          icon: { t: "string", optional: true },
          key: MORPH_KEY,
        },
      },
    },
  },
  bullets: {
    top: { title: { t: "string" } },
    visual: {
      subtitle: { t: "string", optional: true },
      // items は string か {text, level?, cites?, bold?}。混在のため render 側で正規化。
      note: { t: "string", optional: true },
      key: MORPH_KEY, // 箇条書き本文（1 テキストボックス）の morph キー
    },
  },
  agenda: {
    top: { title: { t: "string" } },
    visual: {
      // items は string か {title, desc?, key?}。混在のため render 側で正規化。
      // key は morph 用（丸=.badge / 番号=.num / 題名=!!key）。checkMorphKeys が書式・重複を検査する。
    },
  },
  figure: {
    top: { title: { t: "string" } },
    visual: {
      image: { t: "string" },
      subtitle: { t: "string", optional: true },
      caption: { t: "string", optional: true },
      cite: { t: "string", optional: true },
    },
  },
  split: {
    top: { title: { t: "string" } },
    visual: {
      // items は string か {text, level?, cites?, bold?}。混在のため render 側で正規化。
      image: { t: "string", optional: true },
      imageSide: { t: "string", optional: true },
      subtitle: { t: "string", optional: true },
      caption: { t: "string", optional: true },
      note: { t: "string", optional: true },
      key: MORPH_KEY,       // テキスト列（箇条書き本文）の morph キー
      image_key: MORPH_KEY, // 画像（＋caption）の morph キー
    },
  },
  "big-stat": {
    top: { title: { t: "string" } },
    visual: {
      subtitle: { t: "string", optional: true },
      stats: {
        t: "object[]",
        fields: {
          value: { t: "string" },
          label: { t: "string", optional: true },
          sub: { t: "string", optional: true },
        },
      },
      note: { t: "string", optional: true },
    },
  },
  chart: {
    top: { title: { t: "string" } },
    visual: {
      subtitle: { t: "string", optional: true },
      chartType: { t: "string", optional: true },
      categories: { t: "string[]" },
      series: {
        t: "object[]",
        fields: {
          name: { t: "string", optional: true },
          // values は number[]。専用 kind が無いので存在のみ render 側で扱う。
        },
      },
      note: { t: "string", optional: true },
    },
  },
  table: {
    top: { title: { t: "string" } },
    visual: {
      subtitle: { t: "string", optional: true },
      headers: { t: "string[]", optional: true },
      // rows は string[][]。専用 kind が無いので render 側で扱う。
      note: { t: "string", optional: true },
    },
  },
  "self-intro": {
    top: { title: { t: "string" } },
    visual: {
      subtitle: { t: "string", optional: true },
      footnote: { t: "string", optional: true },
      papers: {
        t: "object[]",
        fields: {
          image: { t: "string" },
          caption: { t: "string", optional: true },
        },
      },
    },
  },
  spectrum: {
    top: { title: { t: "string" } },
    visual: {
      subtitle: { t: "string", optional: true },
      axis: { t: "string", optional: true },
      stops: {
        t: "object[]",
        fields: {
          heading: { t: "string" },
          icon: { t: "string", optional: true },
          body: { t: "string" },
          cites: CITE_ARR,
        },
      },
    },
  },
  "usage-bars": {
    top: { title: { t: "string" } },
    visual: {
      subtitle: { t: "string", optional: true },
      banner: { t: "string", optional: true },
      footnote: { t: "string", optional: true },
      bars: {
        t: "object[]",
        fields: {
          label: { t: "string" },
          value: { t: "number" },
          cite: { t: "string", optional: true },
        },
      },
    },
  },
  "section-recap": {
    top: { title: { t: "string" } },
    visual: {
      methods: {
        t: "object[]",
        fields: {
          level: { t: "string", optional: true },
          name: { t: "string" },
          trait: { t: "string", optional: true },
          fit: { t: "string" },
          limit: { t: "string" },
        },
      },
    },
  },
  "compare-paths": {
    top: { title: { t: "string" } },
    visual: {
      eyebrow: { t: "string", optional: true },
      source: { t: "string" },
      left: { t: "object", fields: { name: { t: "string" }, icon: { t: "string", optional: true }, note: { t: "string" } } },
      right: { t: "object", fields: { name: { t: "string" }, icon: { t: "string", optional: true }, note: { t: "string" } } },
      middle: { t: "string", optional: true },
      diffs_heading: { t: "string", optional: true },
      diffs: { t: "string[]", optional: true },
      conclusion: { t: "string" },
      cite: { t: "string", optional: true },
      cites: CITE_ARR,
    },
  },
  "nested-layers": {
    top: { title: { t: "string" } },
    visual: {
      eyebrow: { t: "string", optional: true },
      outer: { t: "object", fields: { label: { t: "string" }, desc: { t: "string" }, tag: { t: "string", optional: true } } },
      inner: { t: "object", fields: { label: { t: "string" }, desc: { t: "string" }, tag: { t: "string", optional: true } } },
      note: { t: "string", optional: true },
      cite: { t: "string", optional: true },
      cites: CITE_ARR,
    },
  },
  "agent-loop": {
    top: { title: { t: "string" } },
    visual: {
      eyebrow: { t: "string", optional: true },
      hub: { t: "string", optional: true },
      hub_sub: { t: "string", optional: true },
      loop_label: { t: "string", optional: true },
      note: { t: "string", optional: true },
      input: { t: "object", fields: { label: { t: "string" }, example: { t: "string" }, icon: { t: "string", optional: true } } },
      output: { t: "object", fields: { label: { t: "string" }, items: { t: "string[]" }, icon: { t: "string", optional: true } } },
      steps: { t: "object[]", fields: { icon: { t: "string", optional: true }, name: { t: "string" }, body: { t: "string" } } },
      cite: { t: "string", optional: true },
      cites: CITE_ARR,
    },
  },
  "data-flow": {
    top: { title: { t: "string" } },
    visual: {
      eyebrow: { t: "string", optional: true },
      cite: { t: "string", optional: true },
      cites: CITE_ARR,
      lanes: {
        t: "object[]",
        fields: {
          name: { t: "string" },
          home: { t: "string" },
          cloud: { t: "string" },
          flow: { t: "string" },
          flow_label: { t: "string" },
          note: { t: "string" },
          tone: { t: "string" },
          key: MORPH_KEY,
        },
      },
    },
  },
  demo: {
    top: { title: { t: "string" } },
    visual: {
      video: { t: "string" },
      poster: { t: "string", optional: true },
      autoplay: { t: "boolean", optional: true }, // 既定 true: スライド表示で自動再生
      loop: { t: "boolean", optional: true },     // 既定 true: スライドを離れるまでループ
      eyebrow: { t: "string", optional: true },
      points: { t: "string[]", optional: true },
      tryit: { t: "string", optional: true },
      tryit_label: { t: "string", optional: true },
      tryit_url: { t: "string", optional: true },
      tryit_qr: { t: "string", optional: true },
      cite: { t: "string", optional: true },
      cites: CITE_ARR,
    },
  },
};

// ── morph keys ────────────────────────────────────────────
// `visual` 配下の `key` / `*_key` を再帰的に集め、書式と同一スライド内の重複を検査する。
// PowerPoint は同名（`!!key`）の図形を 1 組しか対応付けないため、重複はエラー。
const MORPH_KEY_FIELD_RE = /^(key|[a-z0-9]+_key)$/;

function checkMorphKeys(slideId: string, visual: unknown, errors: string[]): void {
  const seen = new Map<string, string>(); // key → first path
  const walk = (node: unknown, path: string) => {
    if (Array.isArray(node)) {
      node.forEach((v, i) => walk(v, `${path}[${i}]`));
      return;
    }
    if (typeof node !== "object" || node === null) return;
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      const p = `${path}.${k}`;
      if (MORPH_KEY_FIELD_RE.test(k)) {
        if (typeof v !== "string") continue; // 型エラーはスキーマ検査側で出る
        if (!MORPH_KEY_RE.test(v)) {
          errors.push(`${p}: invalid morph key "${v}" (use letters, digits, "_" or "-")`);
        } else if ((RESERVED_MORPH_KEYS as readonly string[]).includes(v)) {
          errors.push(`${p}: morph key "${v}" is reserved for the slide chrome (${RESERVED_MORPH_KEYS.join(", ")})`);
        } else if (seen.has(v)) {
          errors.push(`${p}: duplicate morph key "${v}" (already used at ${seen.get(v)})`);
        } else {
          seen.set(v, p);
        }
      } else {
        walk(v, p);
      }
    }
  };
  walk(visual, `${slideId}.visual`);
}

export interface ValidationResult {
  errors: string[];
  warnings: string[];
}

export function validateSlides(slides: SlideData[], defaults?: DeckDefaults): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();

  if (defaults !== undefined && (typeof defaults !== "object" || defaults === null || Array.isArray(defaults))) {
    errors.push(`defaults: expected object, got ${describe(defaults)}`);
  } else if (defaults) {
    const t = parseTransition("defaults.transition", defaults.transition);
    errors.push(...t.errors);
    warnings.push(...t.warnings);
  }

  for (const slide of slides) {
    if (!slide.id) {
      errors.push("slide missing id");
      continue;
    }
    if (seen.has(slide.id)) errors.push(`duplicate slide id: ${slide.id}`);
    seen.add(slide.id);

    // transition は layout に依らない共通項目（未知 layout でも検査する）
    const t = parseTransition(`${slide.id}.transition`, slide.transition);
    errors.push(...t.errors);
    warnings.push(...t.warnings);
    checkMorphKeys(slide.id, slide.visual, errors);

    const layout = (slide as Record<string, unknown>).layout;
    if (typeof layout !== "string" || !layout) {
      errors.push(`${slide.id}.layout: missing (expected a layout name, e.g. "title", "grid")`);
      continue;
    }

    const schema = SCHEMAS[layout];
    if (!schema) continue; // unknown layout — forward-compatible (render.ts throws if unrenderable)

    const visual = ((slide as Record<string, unknown>).visual ?? {}) as Record<string, unknown>;
    for (const [k, kind] of Object.entries(schema.top ?? {})) {
      checkField(`${slide.id}.${k}`, (slide as Record<string, unknown>)[k], kind, errors, warnings);
    }
    for (const [k, kind] of Object.entries(schema.visual ?? {})) {
      checkField(`${slide.id}.visual.${k}`, visual[k], kind, errors, warnings);
    }
  }
  return { errors, warnings };
}

/**
 * Validate slides and print a human-readable report.
 * Throws if any errors are present.
 */
export function validateSlidesOrThrow(slides: SlideData[], defaults?: DeckDefaults): void {
  const { errors, warnings } = validateSlides(slides, defaults);
  if (warnings.length) {
    console.warn(`[validate] ${warnings.length} warning(s):`);
    for (const w of warnings) console.warn(`  ⚠ ${w}`);
  }
  if (errors.length) {
    const msg = [`slides.yaml validation failed (${errors.length} error(s)):`, ...errors.map((e) => `  ✗ ${e}`)].join("\n");
    throw new Error(msg);
  }
}
