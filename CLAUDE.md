# Presentation Generator

## Overview

PptxGenJS (TypeScript/Bun) によるプレゼンテーション動画自動生成の参照用リポジトリ。
`slides.yaml` にスライド内容とナレーション原稿を定義し、PPTX・PNG・音声・MP4 を一括生成する。

## Project Structure

```
├── slides.yaml              # 全スライドの内容定義 + ナレーション原稿（単一ソース）
├── generate.ts              # メインエントリ（PPTX生成）
├── screenshot.ts            # PPTX → PNG 変換（PowerPoint/LibreOffice 自動選択）
├── tts.ts                   # Gemini TTS でナレーション生成
├── video.ts                 # スライド画像+音声 → MP4 動画生成（ffmpeg）
├── lib/
│   ├── slides-data.ts       # slides.yaml ローダー（getSlide / getAllSlides / getTheme）
│   ├── theme.ts             # 解決済みカラー(C)・フォント・サイズ・レイアウト定数
│   ├── themes.ts            # テーマ定義（preset / シード生成 / 解決ロジック）
│   ├── color.ts             # 色ユーティリティ（HSL変換・派生・コントラスト）
│   ├── helpers.ts           # 再利用可能なスライドビルダー関数
│   ├── text-metrics.ts      # 折り返し推定・禁則/自然改行・バランス（自動修正）
│   ├── instrument.ts        # addText を自動バランス＆ジオメトリ収集
│   ├── lint-wrap.ts         # 折り返し lint（残課題を改修推奨として出力）
│   ├── validate.ts          # slides.yaml 構造バリデーション
│   ├── types.ts             # PptxGenJS 型定義
│   ├── icons.ts             # Material Design Icons ローダー
│   └── cite.ts              # 引用管理（pandoc citekey → APA形式）
├── pages/
│   ├── slide01-title.ts     # タイトル
│   ├── slide02-background.ts # 背景・課題
│   ├── slide03-notebooklm.ts # ツール・手法紹介
│   ├── slide04-steps.ts     # ステップ概要
│   ├── slide04-step-details.ts # 各ステップ詳細（スクリーンショット付き）
│   ├── slide05-risks.ts     # リスクと品質管理
│   ├── slide06-preparation.ts # 事前準備
│   ├── slide07-closing.ts   # まとめ・当日の流れ
│   └── slide08-references.ts # 文献一覧（自動生成）
├── assets/                  # スライドに埋め込む画像
├── screenshots/             # ステップ詳細スライド用スクリーンショット
├── output_images/           # 生成されたスライド画像（PNG）
├── voice_output/            # TTS生成音声（WAV）
└── presentation.pptx        # 生成された PPTX ファイル
```

## Prerequisites

- [Bun](https://bun.sh/) — ランタイム・パッケージマネージャ
- [ref](https://github.com/ncukondo/reference-manager/) — 引用解決に使用。PATH に `ref` コマンドが必要
  - `ref cite <key> --in-text` → APA インテキスト引用（例: `(Qureshi et al., 2023)`）
  - `ref cite <key> --style apa` → APA フルリファレンス
  - 事前に `ref` のライブラリに文献を登録しておくこと
- [ffmpeg](https://ffmpeg.org/) — 動画生成時に必要（`bun run video`）

## スライド作成ワークフロー

新しいスライドの追加・既存スライドの変更は以下の手順で行う。

### 1. slides.yaml にコンテンツを定義

`slides.yaml` にスライドの内容（テキスト・ナレーション原稿）を追加・編集する。
各スライドは `id` で識別される。

### 2. テーマ（配色）を準備

題材に合ったカラーパレットを `slides.yaml` の `theme:` ブロックで決める（詳細は `docs/theme.md`）。

```yaml
theme:
  preset: blue          # blue / warm / forest / slate から選ぶ
  # accent: "00C853"    # 任意の Palette キーを hex で個別上書き
  # primary: "6A1B9A"   # preset を消し primary だけ指定 → 残りを自動生成
```

役割（Primary/Accent/Step…）でテーマを差し替えても、`pages/*.ts` は `C.xxx` 参照なので無改修。

### 3. pages/*.ts でレイアウトを実装

対応する `pages/*.ts` を作成・編集する。
- `getSlide(id)` で yaml からデータを取得
- yaml の構造に合わせてフィールドを読み込む（型アサーションで取得）
- 新規スライドの場合は `generate.ts` に `buildSlideXX(pres)` を追加

### 4. ビルドしてスクリーンショットを出力

```bash
bun run build    # PPTX 生成 + PNG 変換
```

ビルド時、テキストの折り返しは**禁則処理＋自然な区切りで自動バランス**される（`lib/text-metrics.ts`）。
`\n` 挿入で直せないもの（幅不足・縦はみ出し・分割不能な長語）は `[wrap] RECOMMEND` と
`wrap-report.json` に**具体的な改修推奨**が出るので、それに従い `slides.yaml`（短縮）か
`pages/*.ts`（列数・幅）を直す。`WRAP_STRICT=1 bun run build` で推奨残存をビルド失敗扱いにできる。

### 5. 出力画像を確認し修正を繰り返す

`output_images/*.png` を確認し、以下の観点で問題がないかチェックする:

- **レイアウト** — 要素の重なりがないか、想定通りの配置になっているか
- **文字** — 読みにくい折り返しやはみ出しがないか（`[wrap]` 出力も確認）
- **コントラスト** — 背景と文字色の視認性は十分か

デザイン原則の完全な基準は `docs/design-principles.md` を参照。
`bun run qa` で API ベースの自動採点（`docs/qa-prompt.md` に基づく JSON レポート）も可能。

問題があれば `slides.yaml`（内容の調整）・`theme:`（配色）・`pages/*.ts`（レイアウト）を修正し、
再度 `bun run build` → 画像確認を **問題がなくなるまで繰り返す**。

## Content Editing

スライドの内容・ナレーション原稿は `slides.yaml` で一元管理。
各スライドは `id` で識別し、TS側は `getSlide(id)` でテキスト内容を取得する。
レイアウト・スタイリングは各 `pages/*.ts` に残る。

```bash
# yq でナレーション修正
yq '(.slides[] | select(.id == "background")).narration = "新しいナレーション"' -i slides.yaml

# yq でタイトル変更
yq '(.slides[] | select(.id == "title")).subtitle = "新サブタイトル"' -i slides.yaml
```

### 引用キーの指定

`slides.yaml` の `cites` / `cite` フィールドに pandoc 形式の引用キー（`著者名-年`）を指定する。
ビルド時に `lib/cite.ts` が `ref` コマンドで APA 形式に解決する。
参照された文献は最終スライド（slide08-references）に自動収集される。

```yaml
# 複数引用（cites 配列） — background, risks スライド等
cards:
  - heading: 課題1
    body: 説明文
    cites: ["qureshi-2023", "flemyng-2025"]

# 単一引用（cite 文字列） — notebooklm スライドの evidence 等
evidence:
  - heading: 事例1
    body: 説明文
    cite: "qureshi-2023"
```

## Build Commands

```bash
bun run generate      # PPTX 生成のみ
bun run screenshot    # PPTX → PNG 変換
bun run build         # generate + screenshot
bun run qa            # 出力画像のデザイン自動採点（ローカルの claude CLI を使用）
bun run tts           # ナレーション音声生成（要 .env）
bun run video         # スライド画像+音声 → MP4 動画生成（要 ffmpeg）
```

### QA レポート

内部で `claude -p --output-format json --json-schema ...` を画像ごとに起動する。
ログイン済みの Claude Code セッションをそのまま利用するので **API キー不要**。

```bash
bun run qa                              # 全スライドを採点 → qa-report.json
bun run qa -- --only slide_004          # 1 枚だけ採点
bun run qa -- --concurrency 4           # 並列度を上げる
bun run qa -- --model claude-sonnet-4-5 # モデル指定
```

違反があれば標準出力に表示され、1件でも blocker / `pass=false` があれば exit 1 で終了する。
判定基準は `docs/design-principles.md` と `docs/qa-prompt.md` が権威源。

### 配布物の生成（PDF・ハンドアウト・動画自動再生）

生成した PPTX から配布物・上映用ファイルを作る補助スクリプト（いずれも引数で対象 PPTX/PDF を指定）。
`*.sh` は Windows PowerPoint(COM) を使うので **WSL から見える Windows パス**（`/mnt/...`）に対象を置くこと。

```bash
bash tools/set-video-autoplay.sh <pptx>      # 全動画に「自動再生(WithPrevious)＋ループ」を付与（冪等）
                                             #   ついでに PptxGenJS が稀に出す重複 cNvPr id を再保存で解消
bash tools/export-pdf.sh <pptx> [out.pdf]    # PDF 化。非表示(hidden)スライドは除外（元 pptx は不変）
python3 tools/make-handout.py <1up.pdf> [out.pdf] [cols] [rows]  # 6面付けハンドアウト（既定 2x3）。要 PyMuPDF
```

- `set-video-autoplay.sh` … PptxGenJS の埋め込み動画は既定で「クリック再生」。これを上映用に自動再生＋ループへ。
- `export-pdf.sh` … 質疑用などの非表示スライドを配布 PDF から外したい時に。`SlideShowTransition.Hidden` で判定。
- `make-handout.py` … PowerPoint がレンダリングした 1up PDF を入力に PyMuPDF（`pip install pymupdf`）で面付け。

### WSL マウントドライブでのビルド

WSL のマウントドライブ上では bun がシンボリックリンク等の問題で動作しない場合がある。
`/tmp` にコピーしてビルドし、成果物を戻す:

```bash
SRC="/mnt/d/path/to/your/project"
rsync -a --exclude='node_modules' "$SRC/" /tmp/presentation/
cd /tmp/presentation && bun install && bun run build
cp /tmp/presentation/presentation.pptx "$SRC/"
cp /tmp/presentation/output_images/*.png "$SRC/output_images/"
```

## Typography Rules

- **最小フォントサイズ: 22pt**（`FS.body` 以上を使用すること）
- テキストがボックスからはみ出す場合は内容を削減・簡潔にする
- 折り返しは `lib/text-metrics.ts` が禁則・自然な区切りで自動バランス。手動 `\n` を入れる場合もそれが尊重される。

## Theme Constants

- **配色は `slides.yaml` の `theme:` で選択**（preset / シード色 / 個別上書き）。値は `lib/themes.ts`、解決は `lib/theme.ts`。詳細は `docs/theme.md`。
- Colors: `lib/theme.ts` の `C` オブジェクト（役割名で参照。既定 preset `slate` は Primary `#37474F` / Accent `#FF7043`。`blue` 等は `docs/theme.md`）
- Font sizes: `lib/theme.ts` の `FS` オブジェクト
- Fonts: `theme.fonts` で上書き可（既定: メイリオ（日本語）, Arial（英語））
