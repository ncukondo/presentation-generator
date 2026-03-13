/**
 * Presentation Generator — メインエントリポイント
 *
 * slides.yaml の内容を元に PptxGenJS で PPTX ファイルを生成する。
 * 各スライドのレイアウトは pages/*.ts に定義されている。
 *
 * Usage:
 *   bun run generate        # PPTX 生成
 *   bun run screenshot      # PNG 変換
 *   bun run build           # generate + screenshot
 */
import PptxGenJS from "pptxgenjs";
import { SLIDE_W, SLIDE_H } from "./lib/theme";
import { buildSlide01 } from "./pages/slide01-title";
import { buildSlide02 } from "./pages/slide02-background";
import { buildSlide03 } from "./pages/slide03-notebooklm";
import { buildSlide04 } from "./pages/slide04-steps";
import { buildStepDetailSlides } from "./pages/slide04-step-details";
import { buildSlide05 } from "./pages/slide05-risks";
import { buildSlide06 } from "./pages/slide06-preparation";
import { buildSlide07 } from "./pages/slide07-closing";
import { buildSlide08 } from "./pages/slide08-references";

// ── Create presentation ─────────────────────────────────
const pres = new PptxGenJS();
pres.defineLayout({ name: "WIDE16x9", width: SLIDE_W, height: SLIDE_H });
pres.layout = "WIDE16x9";
pres.title = "プレゼンテーション";          // ← slides.yaml のタイトルに合わせて変更
pres.author = "作成者名";                    // ← 発表者名に変更
pres.subject = "プレゼンテーション動画";     // ← 用途に合わせて変更

// ── Build all slides ────────────────────────────────────
buildSlide01(pres);  // タイトル
buildSlide02(pres);  // 背景・課題
buildSlide03(pres);  // ツール・手法紹介（2カラム: 特徴 + エビデンス）
buildSlide04(pres);  // ステップ概要（7ステップ一覧）
buildStepDetailSlides(pres);  // 各ステップ詳細（スクリーンショット付き）
buildSlide05(pres);  // リスクと品質管理（2カラム: リスク + 対策）
buildSlide06(pres);  // 事前準備（2x2 チェックリスト）
buildSlide07(pres);  // クロージング（タイムライン + 締めメッセージ）
buildSlide08(pres);  // 文献一覧（cite() で参照した文献を自動収集）

// ── Save ────────────────────────────────────────────────
const fileName = "presentation.pptx";
await pres.writeFile({ fileName });
console.log(`Done: ${fileName} (${pres.slides.length} slides)`);
