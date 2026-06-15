/**
 * gen-refs.ts — collect citekeys from slides.yaml, format them with the local
 *   `ref` CLI, and cache the result to assets/references.json.
 *
 * This decouples the production build from `ref`: build-time reads the cache
 * (deterministic, reproducible). Re-run this whenever you add/remove citations.
 *
 * Usage: bun run gen-refs
 * Requires: `ref` (a CSL-JSON-emitting reference manager) on PATH.
 *           See https://github.com/ncukondo/reference-manager
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { parse } from "yaml";
import { collectCitedIds, formatCsl, type RefEntry } from "../lib/refs";

const YAML_CANDIDATES = [
  process.env.SLIDES_YAML,
  join(import.meta.dir, "../slides.yaml"),
].filter(Boolean) as string[];

const OUT_PATH = join(import.meta.dir, "../assets/references.json");

function loadDoc(): unknown {
  for (const p of YAML_CANDIDATES) {
    let raw: string;
    try { raw = readFileSync(p, "utf-8"); } catch { continue; /* not here → next */ }
    // A readable-but-broken file is a hard error (don't silently fall back).
    try { return parse(raw); }
    catch (e) { throw new Error(`slides.yaml YAML parse error (${p}): ${(e as Error).message}`); }
  }
  throw new Error(`slides.yaml not found (looked in: ${YAML_CANDIDATES.join(" , ")})`);
}

const doc = loadDoc();
const ids = collectCitedIds(doc);
console.log(`[gen-refs] collected ${ids.length} citation(s)`);

if (ids.length === 0) {
  writeFileSync(OUT_PATH, JSON.stringify({ count: 0, entries: [] }, null, 2) + "\n");
  console.log("[gen-refs] no citations → wrote empty cache");
  process.exit(0);
}

// `ref export <ids...> -o json` → CSL-JSON array
const proc = Bun.spawnSync(["ref", "export", ...ids, "-o", "json"], { stdout: "pipe", stderr: "pipe" });
if (proc.exitCode !== 0) {
  console.error("[gen-refs] `ref export` failed:", new TextDecoder().decode(proc.stderr));
  process.exit(1);
}
const csl: any[] = JSON.parse(new TextDecoder().decode(proc.stdout));
const byId = new Map<string, any>(csl.map((c) => [c.id, c]));

const missing = ids.filter((id) => !byId.has(id));
if (missing.length) console.warn(`[gen-refs] unresolved (not in library) ${missing.length}: ${missing.join(", ")}`);

// Format → sort by first-author family + year (bibliographies are alphabetical).
const entries: RefEntry[] = csl
  .map((item) => ({
    id: item.id as string,
    text: formatCsl(item),
    _sort: `${(item.author?.[0]?.family ?? item.author?.[0]?.literal ?? item.title ?? "").toLowerCase()} ${(item.issued?.["date-parts"]?.[0]?.[0] ?? 0)}`,
  }))
  .sort((a, b) => a._sort.localeCompare(b._sort))
  .map(({ id, text }) => ({ id, text }));

writeFileSync(OUT_PATH, JSON.stringify({ generatedFrom: ids.length, count: entries.length, entries }, null, 2) + "\n");
console.log(`[gen-refs] OK -> ${OUT_PATH} (${entries.length} entries)`);
for (const e of entries) console.log(`  - ${e.text}`);
