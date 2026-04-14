/**
 * Design QA — runs each slide PNG through the Claude Code CLI (`claude -p`)
 * and produces a structured report of design principle violations.
 *
 * Uses your existing Claude Code authentication — no ANTHROPIC_API_KEY needed.
 *
 * Usage:
 *   bun run qa
 *   bun run qa -- --only slide_002
 *   bun run qa -- --concurrency 3
 *   bun run qa -- --model claude-sonnet-4-5
 *
 * Output:
 *   - stdout: human-readable summary
 *   - qa-report.json: full structured results
 *   - exit code 0 if all pass, 1 if any blocker or pass=false, 2 on runner error
 */
import { readFileSync, writeFileSync, readdirSync } from "fs";
import { resolve, basename } from "path";
import { spawn } from "child_process";

// ── CLI args ─────────────────────────────────────────────
const args = process.argv.slice(2);
function argVal(flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
}
const onlyId = argVal("--only");
const concurrency = Math.max(1, parseInt(argVal("--concurrency") ?? "2"));
const model = argVal("--model"); // optional
const claudeBin = process.env.CLAUDE_BIN ?? "claude";

// ── Paths / prompts ──────────────────────────────────────
const ROOT = import.meta.dir;
const imagesDir = resolve(ROOT, "output_images");
const principlesPath = resolve(ROOT, "docs/design-principles.md");
const qaPromptPath = resolve(ROOT, "docs/qa-prompt.md");

for (const p of [principlesPath, qaPromptPath]) {
  try { readFileSync(p); } catch {
    console.error(`[qa] missing required file: ${p}`);
    process.exit(2);
  }
}

const allImages = readdirSync(imagesDir).filter((f) => f.endsWith(".png")).sort();
const images = onlyId ? allImages.filter((f) => f.includes(onlyId)) : allImages;
if (images.length === 0) {
  console.error("[qa] No images to review.");
  process.exit(2);
}

console.log(`[qa] Reviewing ${images.length} slide(s) via \`${claudeBin} -p\` (concurrency=${concurrency})${model ? `, model=${model}` : ""}...`);

// ── Report shape + JSON schema for structured output ─────
interface Issue {
  severity: "blocker" | "major" | "minor";
  category: string;
  description: string;
  where: string;
}
interface SlideReport {
  slide: string;
  score: number;
  pass: boolean;
  issues: Issue[];
  error?: string;
}

// ── Single review ────────────────────────────────────────
function runClaude(prompt: string): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolveP) => {
    const cliArgs = [
      "-p",
      "--output-format", "json",
      "--allowedTools", "Read",
      "--no-session-persistence",
    ];
    if (model) cliArgs.push("--model", model);
    cliArgs.push(prompt);

    const child = spawn(claudeBin, cliArgs, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.on("data", (d) => (stdout += d.toString()));
    child.stderr.on("data", (d) => (stderr += d.toString()));
    child.on("close", (code) => resolveP({ stdout, stderr, code: code ?? -1 }));
    child.on("error", (e) => resolveP({ stdout, stderr: stderr + String(e), code: -1 }));
  });
}

function extractResult(cliStdout: string): string | null {
  // claude -p --output-format json returns: { "type": "result", "result": "<text>", ... }
  try {
    const outer = JSON.parse(cliStdout);
    if (typeof outer.result === "string") return outer.result;
    if (typeof outer.result === "object") return JSON.stringify(outer.result);
  } catch { /* fall through */ }
  return null;
}

function parseReport(text: string): any {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1]!.trim() : trimmed;
  try { return JSON.parse(candidate); } catch { /* fall through */ }
  const m = candidate.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

async function reviewOne(filename: string): Promise<SlideReport> {
  const slideId = basename(filename, ".png");
  const imgPath = resolve(imagesDir, filename);

  const prompt = [
    `You are a strict presentation QA reviewer.`,
    ``,
    `Read these three files in order:`,
    `1. ${qaPromptPath} — the review prompt, checklist, and scoring rules`,
    `2. ${principlesPath} — the authoritative design principles`,
    `3. ${imgPath} — the slide image to review (slide id: "${slideId}")`,
    ``,
    `Then respond with ONLY a JSON object in this exact shape (no prose, no markdown fence):`,
    `{`,
    `  "slide": "${slideId}",`,
    `  "score": <int 0-100>,`,
    `  "pass": <boolean>,`,
    `  "issues": [`,
    `    {"severity": "blocker"|"major"|"minor", "category": "<kebab-case>", "description": "<short>", "where": "<location>"}`,
    `  ]`,
    `}`,
    ``,
    `Scoring: start at 100, subtract 30 per blocker, 10 per major, 3 per minor, clamp to 0. pass = (no blockers AND score>=70).`,
    `Be strict. Flag overflow, overlap, unnatural wrap, low contrast, empty regions, color misuse, decorative icons, placeholder text, and broken citations.`,
  ].join("\n");

  const { stdout, stderr, code } = await runClaude(prompt);
  if (code !== 0) {
    return {
      slide: slideId, score: 0, pass: false, issues: [],
      error: `claude exit ${code}: ${stderr.slice(0, 300) || stdout.slice(0, 300)}`,
    };
  }
  const inner = extractResult(stdout);
  if (!inner) {
    return {
      slide: slideId, score: 0, pass: false, issues: [],
      error: `could not extract result from CLI output: ${stdout.slice(0, 300)}`,
    };
  }
  const parsed = parseReport(inner);
  if (!parsed) {
    return {
      slide: slideId, score: 0, pass: false, issues: [],
      error: `unparseable JSON: ${inner.slice(0, 300)}`,
    };
  }
  return {
    slide: parsed.slide ?? slideId,
    score: typeof parsed.score === "number" ? parsed.score : 0,
    pass: typeof parsed.pass === "boolean" ? parsed.pass : false,
    issues: Array.isArray(parsed.issues) ? parsed.issues : [],
  };
}

// ── Concurrent runner ────────────────────────────────────
async function runAll(): Promise<SlideReport[]> {
  const results: SlideReport[] = [];
  let idx = 0;
  async function worker() {
    while (idx < images.length) {
      const i = idx++;
      const f = images[i]!;
      process.stderr.write(`  [${i + 1}/${images.length}] ${f}\n`);
      try {
        results[i] = await reviewOne(f);
      } catch (e) {
        results[i] = {
          slide: basename(f, ".png"), score: 0, pass: false, issues: [],
          error: e instanceof Error ? e.message : String(e),
        };
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

const results = await runAll();
writeFileSync(resolve(ROOT, "qa-report.json"), JSON.stringify(results, null, 2));

// ── Pretty summary ──────────────────────────────────────
let anyFail = false;
console.log("");
console.log("─── QA REPORT " + "─".repeat(60));
for (const r of results) {
  const mark = r.error ? "⚠" : r.pass ? "✓" : "✗";
  const statusColor = r.pass ? "\x1b[32m" : "\x1b[31m";
  const reset = "\x1b[0m";
  console.log(`${statusColor}${mark}${reset} ${r.slide.padEnd(14)} score=${String(r.score).padStart(3)}  ${r.issues.length} issue(s)${r.error ? "  ⚠ " + r.error : ""}`);
  if (!r.pass) anyFail = true;
  for (const iss of r.issues) {
    const sevColor = iss.severity === "blocker" ? "\x1b[31m" : iss.severity === "major" ? "\x1b[33m" : "\x1b[90m";
    console.log(`    ${sevColor}[${iss.severity}]${reset} ${iss.category} @ ${iss.where}: ${iss.description}`);
  }
}
console.log("─".repeat(74));
console.log(`Wrote qa-report.json (${results.length} slide(s))`);
process.exit(anyFail ? 1 : 0);
