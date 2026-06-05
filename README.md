# Presentation Generator

PptxGenJS (TypeScript/Bun) + Gemini TTS + ffmpeg によるプレゼンテーション動画自動生成ツール。

`slides.yaml` にスライド内容とナレーション原稿を定義し、PPTX → PNG → 音声 → MP4 を一括生成する。
**題材ごとにクローンして使う汎用テンプレート**として設計されており、`slides.yaml`（内容）と
`theme:`（配色）を差し替えるだけで、別テーマのプレゼンに流用できる。

## 機能

- **PPTX 生成** — `slides.yaml` に定義したスライド内容から PowerPoint ファイルを生成
- **テーマ（配色）の切替** — `slides.yaml` の `theme:` ブロックで配色を一元指定（preset / シード色 / 個別上書き）。`pages/*.ts` は役割名（`C.xxx`）参照なので無改修
- **折り返しの自動修正** — ビルド時にテキストを禁則処理＋自然な区切りで自動バランス。直せないものは改修推奨を出力
- **構造バリデーション** — `slides.yaml` の型・必須フィールドをビルド前に検査
- **スクリーンショット** — PPTX を PNG 画像に変換（PowerPoint / LibreOffice 自動選択）
- **デザイン QA** — 出力画像をローカルの Claude Code CLI で自動採点
- **ナレーション生成** — Gemini Native Audio API による TTS 音声生成
- **動画生成** — スライド画像 + ナレーション音声を ffmpeg で MP4 に合成

## テンプレートとしての使い方

題材ごとにこのリポジトリをクローンし、コンテンツと配色を差し替えて使う。

```bash
git clone <this-repo> my-presentation
cd my-presentation
bun install
```

1. `slides.yaml` の内容・ナレーションを差し替える
2. `theme:` ブロックで題材に合った配色を選ぶ（`docs/theme.md`）
3. `pages/*.ts` でレイアウトを調整（テーマ変更だけなら `C.xxx` 参照のため無改修）
4. `bun run build` → `output_images/*.png` を確認して修正ループ

## セットアップ

```bash
bun install
```

### 環境変数

```bash
cp .env.example .env
# .env に Gemini API キーを設定（TTS 利用時のみ必要）
```

### 外部ツール

- **スクリーンショット** (`bun run screenshot`) は環境に応じてバックエンドを自動選択:
  - **WSL + PowerPoint** — PowerShell COM 経由（自動検出）
  - **LibreOffice + pdftoppm** — `apt install libreoffice poppler-utils`
- **動画生成** には [ffmpeg](https://ffmpeg.org/) が必要
- **引用解決** には [ref](https://github.com/ncukondo/reference-manager/) コマンドが PATH に必要（`slides.yaml` の `cites` / `cite` を APA 形式に解決。引用を使わない場合は不要）
- **デザイン QA** (`bun run qa`) はログイン済みのローカル `claude` CLI を利用するため API キー不要

## 使い方

```bash
bun run generate      # PPTX 生成のみ
bun run screenshot    # PPTX → PNG 変換
bun run build         # generate + screenshot
bun run qa            # 出力画像のデザイン自動採点（claude CLI 使用、API キー不要）
bun run tts           # ナレーション音声生成（要 .env）
bun run video         # スライド画像+音声 → MP4 動画生成（要 ffmpeg）
```

## プロジェクト構成

```
├── slides.yaml              # 全スライドの内容定義 + ナレーション原稿（単一ソース）+ theme: ブロック
├── generate.ts              # メインエントリ（PPTX 生成）
├── screenshot.ts            # PPTX → PNG 変換（PowerPoint/LibreOffice 自動選択）
├── tts.ts                   # Gemini TTS でナレーション生成
├── video.ts                 # スライド画像+音声 → MP4 動画生成
├── qa.ts                    # 出力画像のデザイン自動採点（claude CLI）
├── lib/
│   ├── slides-data.ts       # slides.yaml ローダー（getSlide / getAllSlides / getTheme）
│   ├── theme.ts             # 解決済みカラー(C)・フォント・サイズ・レイアウト定数
│   ├── themes.ts            # テーマ定義（preset / シード生成 / 解決ロジック）
│   ├── color.ts             # 色ユーティリティ（HSL 変換・派生・コントラスト）
│   ├── helpers.ts           # 再利用可能なスライドビルダー関数
│   ├── layouts/             # 再利用可能なレイアウト部品
│   ├── text-metrics.ts      # 折り返し推定・禁則/自然改行・バランス（自動修正）
│   ├── instrument.ts        # addText を自動バランス＆ジオメトリ収集
│   ├── lint-wrap.ts         # 折り返し lint（残課題を改修推奨として出力）
│   ├── validate.ts          # slides.yaml 構造バリデーション
│   ├── types.ts             # PptxGenJS 型定義
│   ├── icons.ts             # Material Design Icons ローダー
│   └── cite.ts              # 引用管理（pandoc citekey → APA形式）
├── pages/                   # 各スライドのレイアウト定義
├── docs/                    # テーマ・デザイン原則・QA プロンプトのガイド
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

### テーマ（配色）の変更

配色は `slides.yaml` の `theme:` ブロックで選択する（`lib/themes.ts` が解決、詳細は `docs/theme.md`）。

```yaml
theme:
  preset: blue          # blue / warm / forest / slate から選ぶ
  # accent: "00C853"    # 任意の Palette キーを hex で個別上書き
  # primary: "6A1B9A"   # preset を消し primary だけ指定 → 残りを自動生成
```

役割（Primary/Accent/Step…）でテーマを差し替えても、`pages/*.ts` は `C.xxx` 参照なので無改修。
フォント・サイズの定数は `lib/theme.ts`、レイアウトは各 `pages/*.ts` に定義。

## ワークフロー

1. `slides.yaml` にスライド内容・ナレーション原稿を記述
2. `theme:` ブロックで題材に合った配色を準備（`docs/theme.md`）
3. `pages/*.ts` に各スライドのレイアウトを実装
4. `bun run build` で PPTX + PNG を生成（折り返しは自動バランス。直せないものは `[wrap] RECOMMEND` で改修推奨を出力）
5. `output_images/*.png` を確認し、レイアウト・文字・コントラストを検証して修正ループ（`bun run qa` で自動採点も可）
6. `bun run tts` でナレーション音声を生成
7. `bun run video` で最終動画を合成

詳しい作成手順は `CLAUDE.md`、デザイン基準は `docs/design-principles.md` を参照。

## デザインルール

- 最小フォントサイズ: 22pt
- 配色: `slides.yaml` の `theme:` で選択（preset / シード色 / 個別上書き、`docs/theme.md`）
- フォント: メイリオ（日本語）、Arial（英語）— `theme.fonts` で上書き可
- 折り返し: ビルド時に禁則処理＋自然な区切りで自動バランス（`lib/text-metrics.ts`）
- 完全な基準は `docs/design-principles.md`、自動採点は `bun run qa`（`docs/qa-prompt.md`）
