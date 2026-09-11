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
import { getDefaults } from "./lib/slides-data";
import { renderSlide } from "./lib/render";
import { resolveTransition } from "./lib/transitions";
import { postProcessPptx, takeMediaPlayback, type SlidePostSpec } from "./lib/postprocess";

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
// 切り替え効果（transition）と動画の自動再生（timing）は PptxGenJS に API が無いので、
// 描画されたスライドの通し番号（= ppt/slides/slideN.xml）ごとに控えておき、保存直前に
// lib/postprocess.ts が XML へ注入する。renderSlide が undefined を返す（references で
// 引用ゼロ等）スライドは番号を消費しない。
const defaults = getDefaults();
const post = new Map<number, SlidePostSpec>();
let slideNo = 0;
for (const s of getDeck()) {
  const slide = renderSlide(pres, s);
  if (!slide) continue;
  slideNo++;
  const spec: SlidePostSpec = {};
  const t = resolveTransition(s.transition, defaults.transition);
  if (t) spec.transition = t;
  const media = takeMediaPlayback(slide);
  if (media.length) spec.media = media;
  if (spec.transition || spec.media) post.set(slideNo, spec);
}

// ── Wrap lint ───────────────────────────────────────────
// Surfaces anything auto-balancing couldn't fix (too-narrow / overflow /
// forced break) as agent-actionable recommendations + wrap-report.json.
reportWrapLint(getCollected());

// ── Save ────────────────────────────────────────────────
const fileName = "presentation.pptx";
// `slides` is an internal array not in PptxGenJS's public types — cast to read its length.
const total = (pres as any).slides.length as number;
if (total !== slideNo) {
  throw new Error(`slide count mismatch: rendered ${slideNo}, PptxGenJS has ${total} (transition numbering would be off)`);
}
const rendered = (await pres.write({ outputType: "nodebuffer" })) as Uint8Array;
const { data, summary } = await postProcessPptx(rendered, post);
if (summary.transitions) {
  const kinds = [...post.values()].map((p) => p.transition?.type).filter(Boolean);
  console.log(`[transition] applied to ${summary.transitions} slide(s): ${[...new Set(kinds)].join(", ")}`);
}
if (summary.mediaSlides) console.log(`[media] autoplay/loop timing on ${summary.mediaSlides} slide(s)`);
if (summary.renumberedSlides.length) {
  console.log(`[postprocess] repaired duplicate shape ids on slide(s): ${summary.renumberedSlides.join(", ")}`);
}
await Bun.write(fileName, data);
console.log(`Done: ${fileName} (${total} slides)`);
