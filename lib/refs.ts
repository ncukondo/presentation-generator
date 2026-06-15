/**
 * refs.ts — deterministic, cached data for a References slide.
 *
 * Why this exists alongside `lib/cite.ts`:
 *   `cite.ts` resolves citekeys by shelling out to the `ref` CLI *during the
 *   build* (in-text APA). That is convenient but non-deterministic and fails
 *   if `ref` is not installed. This module takes the opposite trade-off:
 *   collect every citekey from `slides.yaml`, format the bibliography ONCE via
 *   `ref` (see tools/gen-refs.ts), and cache the result to
 *   `assets/references.json`. Production builds then read the cache and are
 *   fully `ref`-independent and reproducible.
 *
 *   - collect + format + write cache … tools/gen-refs.ts (`bun run gen-refs`).
 *     Re-run when you add/remove citations.
 *   - read cache ………………………… loadReferenceEntries() (used by a page).
 *
 * Both citation styles are supported as input:
 *   - pandoc citations in free text: `[@key]` / `(@key)`
 *   - `cite:` (string) / `cites:` (array) fields, with or without a leading @
 */
import { readFileSync } from "fs";
import { join } from "path";

export interface RefEntry {
  id: string;
  text: string;   // display-ready: "Authors. Journal. Year;Vol(Issue):Pages."
}

/** Placeholder citekeys (e.g. doc examples) that are never real references. */
const IGNORE_IDS = new Set(["id", "key"]);

const CITEKEY_RE = /^[A-Za-z][\w-]*$/;
// pandoc citations: `[@key]` / `(@key)` / a standalone `@key`. The lookbehind
// excludes an `@` that follows a word char, `/`, `.`, or another `@`, so emails
// (`user@host`) and URLs (`x.com/@handle`) are NOT mistaken for citations.
const PANDOC_RE = /(?<![\w/.@])@([A-Za-z][\w-]*)/g;

function addId(id: string, seen: Set<string>, out: string[]): void {
  const k = id.replace(/^@/, "").trim();
  if (!k || !CITEKEY_RE.test(k) || IGNORE_IDS.has(k) || seen.has(k)) return;
  seen.add(k);
  out.push(k);
}

/**
 * Walk an arbitrary deck object and collect cited citekeys in first-seen order.
 *  - pandoc `[@key]` / `@key` appearing in any string value
 *  - values of `cite` (string) and `cites` (array of strings) fields anywhere
 */
export function collectCitedIds(doc: unknown): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  const visit = (node: unknown): void => {
    if (node == null) return;
    if (typeof node === "string") {
      let m: RegExpExecArray | null;
      PANDOC_RE.lastIndex = 0;
      while ((m = PANDOC_RE.exec(node)) !== null) addId(m[1]!, seen, out);
      return;
    }
    if (Array.isArray(node)) {
      for (const v of node) visit(v);
      return;
    }
    if (typeof node === "object") {
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        if (k === "cite" && typeof v === "string") addId(v, seen, out);
        else if (k === "cites" && Array.isArray(v)) {
          for (const item of v) if (typeof item === "string") addId(item, seen, out);
        }
        visit(v);
      }
    }
  };

  visit(doc);
  return out;
}

// ── CSL-JSON → display string ─────────────────────────────

/** Initials from a given name ("Daniel A" → "DA", "Hidefumi" → "H"). */
function initials(given?: string): string {
  if (!given) return "";
  return given
    .split(/[\s.\-]+/)
    .filter(Boolean)
    .map((t) => t[0]?.toUpperCase() ?? "")
    .join("");
}

/** Author list → "Family AB, Family CD, et al." (et al. past 3 names). */
function formatAuthors(authors?: Array<{ family?: string; given?: string; literal?: string }>): string {
  if (!authors || authors.length === 0) return "";
  const names = authors.map((a) => {
    if (a.literal) return a.literal;
    const ini = initials(a.given);
    return [a.family, ini].filter(Boolean).join(" ");
  });
  if (names.length <= 3) return names.join(", ");
  return names.slice(0, 3).join(", ") + ", et al.";
}

function year(item: any): string {
  const dp = item?.issued?.["date-parts"]?.[0]?.[0];
  return dp ? String(dp) : "n.d.";
}

/**
 * Format one CSL-JSON item to "Authors. Journal. Year;Vol(Issue):Pages.".
 * The title is omitted: on a slide it is long and hard to read, so we keep the
 * attribution (authors / container / year), which is the conference convention.
 */
export function formatCsl(item: any): string {
  const parts: string[] = [];
  const authors = formatAuthors(item.author);
  if (authors) parts.push(authors.replace(/\.?$/, ".").replace(/\.\.$/, "."));

  const container = (item["container-title"] ?? "").trim();
  if (container) parts.push(container.replace(/\.?$/, "."));

  let loc = year(item);
  if (item.volume) {
    loc += `;${item.volume}`;
    if (item.issue) loc += `(${item.issue})`;
    if (item.page) loc += `:${item.page}`;
  } else if (item.page) {
    loc += `:${item.page}`;
  }
  parts.push(loc + ".");

  return parts.join(" ").replace(/\s+/g, " ").trim();
}

// ── cache loading ─────────────────────────────────────────

/** Read `assets/references.json` (the gen-refs output). Empty array if absent. */
export function loadReferenceEntries(): RefEntry[] {
  const candidates = [
    join(import.meta.dir, "../assets/references.json"),
    join(import.meta.dir, "../../assets/references.json"),
  ];
  for (const p of candidates) {
    try {
      const data = JSON.parse(readFileSync(p, "utf-8"));
      if (Array.isArray(data?.entries)) return data.entries as RefEntry[];
      if (Array.isArray(data)) return data as RefEntry[];
    } catch { /* try next */ }
  }
  return [];
}
