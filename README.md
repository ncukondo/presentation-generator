# Presentation Generator

PptxGenJS (TypeScript/Bun) + Gemini TTS + ffmpeg によるプレゼンテーション動画自動生成ツール。

`slides.yaml` にスライド内容とナレーション原稿を定義し、PPTX → PNG → 音声 → MP4 を一括生成する。

## 機能

- **PPTX 生成** — `slides.yaml` に定義したスライド内容から PowerPoint ファイルを生成
- **スクリーンショット** — PPTX を PNG 画像に変換（PowerPoint / LibreOffice 自動選択）
- **ナレーション生成** — Gemini Native Audio API による TTS 音声生成
- **動画生成** — スライド画像 + ナレーション音声を ffmpeg で MP4 に合成

## セットアップ

```bash
bun install
```

### 環境変数

```bash
cp .env.example .env
# .env に Gemini API キーを設定
```

### 外部ツール

スクリーンショット (`bun run screenshot`) は環境に応じてバックエンドを自動選択します:

- **WSL + PowerPoint** — PowerShell COM 経由（自動検出）
- **LibreOffice + pdftoppm** — `apt install libreoffice poppler-utils`

動画生成には [ffmpeg](https://ffmpeg.org/) が必要です。

## 使い方

```bash
bun run generate      # PPTX 生成のみ
bun run screenshot    # PPTX → PNG 変換
bun run build         # generate + screenshot
bun run tts           # ナレーション音声生成（要 .env）
bun run video         # スライド画像+音声 → MP4 動画生成（要 ffmpeg）
```

## プロジェクト構成

```
├── slides.yaml              # 全スライドの内容定義 + ナレーション原稿（単一ソース）
├── generate.ts              # メインエントリ（PPTX 生成）
├── screenshot.ts            # PPTX → PNG 変換（PowerPoint/LibreOffice 自動選択）
├── tts.ts                   # Gemini TTS でナレーション生成
├── video.ts                 # スライド画像+音声 → MP4 動画生成
├── lib/
│   ├── slides-data.ts       # slides.yaml ローダー（getSlide / getAllSlides）
│   ├── theme.ts             # カラー、フォント、レイアウト定数
│   ├── helpers.ts           # 再利用可能なスライドビルダー関数
│   ├── types.ts             # PptxGenJS 型定義
│   ├── icons.ts             # Material Design Icons ローダー
│   └── cite.ts              # 引用管理（pandoc citekey → APA形式）
├── pages/                   # 各スライドのレイアウト定義
├── assets/                  # スライドに埋め込む画像
├── screenshots/             # ステップ詳細スライド用スクリーンショット
├── output_images/           # 生成されたスライド画像（PNG）
└── voice_output/            # TTS 生成音声（WAV）
```

## カスタマイズ

### スライド内容の変更

スライドの内容・ナレーション原稿は `slides.yaml` で一元管理。
各スライドは `id` で識別し、TS 側は `getSlide(id)` でテキスト内容を取得する。

```bash
# yq でナレーション修正
yq '(.slides[] | select(.id == "background")).narration = "新しいナレーション"' -i slides.yaml
```

### テーマの変更

- カラー・フォント・サイズ: `lib/theme.ts` で一元管理
- レイアウト: 各 `pages/*.ts` に定義

## ワークフロー

1. `slides.yaml` にスライド内容・ナレーション原稿を記述
2. `pages/*.ts` に各スライドのレイアウトを実装
3. `bun run build` で PPTX + PNG を生成
4. `bun run tts` でナレーション音声を生成
5. `bun run video` で最終動画を合成

## デザインルール

- 最小フォントサイズ: 22pt
- カラーテーマ: `lib/theme.ts` で一元管理
- フォント: メイリオ（日本語）、Arial（英語）
