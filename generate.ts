/**
 * Presentation Generator — メインエントリポイント
 *
 * slides.yaml の各スライドが宣言する `layout` を見て、汎用レンダラ
 * (lib/render.ts) が描画する **データ駆動モード**。スライドの追加・編集・
 * 並べ替えは slides.yaml の編集だけで完結する（コード変更不要）。
 *
 * Usage:
 *   bun run generate        # PPTX 生成
 *   bun run screenshot      # PNG 変換
 *   bun run build           # generate + screenshot
 */
import PptxGenJS from "pptxgenjs";
import { SLIDE_W, SLIDE_H } from "./lib/theme";
import { instrumentPres, getCollected } from "./lib/instrument";
import { reportWrapLint } from "./lib/lint-wrap";
import { getDeck } from "./lib/deck";
import { renderSlide } from "./lib/render";

// ── Create presentation ─────────────────────────────────
const pres = new PptxGenJS();
// Auto-balance line breaks (natural / kinsoku-aware) and collect text geometry
// for the wrap linter. Must run before any slide is built.
instrumentPres(pres);
pres.defineLayout({ name: "WIDE16x9", width: SLIDE_W, height: SLIDE_H });
pres.layout = "WIDE16x9";
pres.title = "プレゼンテーション";          // ← slides.yaml のタイトルに合わせて変更
pres.author = "作成者名";                    // ← 発表者名に変更
pres.subject = "プレゼンテーション動画";     // ← 用途に合わせて変更

// ── Build all slides ────────────────────────────────────
// slides.yaml の並び順 = スライドの順序。各スライドの `layout` で描画を切り替える。
for (const s of getDeck()) renderSlide(pres, s);

// ── Wrap lint ───────────────────────────────────────────
// Surfaces anything auto-balancing couldn't fix (too-narrow / overflow /
// forced break) as agent-actionable recommendations + wrap-report.json.
reportWrapLint(getCollected());

// ── Save ────────────────────────────────────────────────
const fileName = "presentation.pptx";
await pres.writeFile({ fileName });
// `slides` is an internal array not in PptxGenJS's public types — cast to read its length.
console.log(`Done: ${fileName} (${(pres as any).slides.length} slides)`);
