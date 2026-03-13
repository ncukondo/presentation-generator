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
│   ├── slides-data.ts       # slides.yaml ローダー（getSlide / getAllSlides）
│   ├── theme.ts             # カラー、フォント、サイズ、レイアウト定数
│   ├── helpers.ts           # 再利用可能なスライドビルダー関数
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
bun run tts           # ナレーション音声生成（要 .env）
bun run video         # スライド画像+音声 → MP4 動画生成（要 ffmpeg）
```

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

## Theme Constants

- Colors: `lib/theme.ts` の `C` オブジェクト（Primary: `#1E88E5`, Accent: `#FF9800`）
- Font sizes: `lib/theme.ts` の `FS` オブジェクト
- Fonts: メイリオ（日本語）, Arial（英語）
