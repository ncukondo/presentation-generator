# Layouts（データ駆動モードの語彙）

各スライドは `slides.yaml` で `layout`（レンダラ名）を宣言し、`visual` にそのレイアウト固有の
パラメータを持つ。汎用レンダラ（`lib/render.ts`）が `layout` を見て描画する。**`id` への特別
配線は一切無い** — `layout` がディスパッチの唯一のキー。

共通フィールド（全 layout）:

| フィールド | 必須 | 説明 |
|---|---|---|
| `id` | ✅ | 一意識別子（重複不可）。表示順は配列の並び順。 |
| `layout` | ✅ | 下表のいずれか。 |
| `title` | layout 依存 | スライドタイトル（多くの layout で使用）。 |
| `narration` | 任意 | TTS・動画の**読み上げ原稿**。指定時は PowerPoint ノート欄にも入る。 |
| `notes` | 任意 | PowerPoint **ノート専用メモ**。TTS/動画では読み上げない。`narration` より優先。 |
| `visual` | layout 依存 | レイアウト別パラメータ（下表）。 |

> **ノート欄に入る文字列 = `notes ?? narration`**。
> - **ナレーション動画を作る** → `narration` を書く（音声＋ノートの両方になる）。
> - **ナレーション不要・登壇メモだけ欲しい** → `notes` を書く（ノートに出るが TTS は無視）。
>
> **`notes`/`narration` と `visual.note` の違い**：前者は**スピーカーノート**（PowerPoint のノート欄）。
> `visual.note` は**スライド面上**に描かれる小さなキャプション。別物。

---

## layout 一覧と visual スキーマ

### `title` — タイトルスライド
| visual | 型 | 必須 |
|---|---|---|
| `subtitle` | string | ✅ |
| `presenter` | string | ✅ |

### `grid` — 3カラム番号付きカード（背景・課題向け）
| visual | 型 | 必須 |
|---|---|---|
| `subtitle` | string | ✅ |
| `cards[]` | `{heading, body, detail?, cites?[]}` | ✅ |

### `evidence` — 2カラム（左:特徴リスト / 右:エビデンスカード）
| visual | 型 | 必須 |
|---|---|---|
| `subtitle` | string | ✅ |
| `features[]` | string[] | ✅ |
| `evidence_heading` | string | ✅ |
| `evidence[]` | `{heading, body, cite?}` | ✅ |
| `figure` / `figure_cite` | string | 任意（`assets/` 内の補足画像） |
| `url` | string | 任意 |

### `steps` — ステップ一覧（4-3 グリッド）
| visual | 型 | 必須 |
|---|---|---|
| `subtitle` | string | 任意 |
| `steps[]` | string[] | ✅ |
| `note` | string | 任意（下部キャプション） |

### `step-detail` — スクリーンショット1枚＋注釈
タイトルは `Step <step>：<title>` として描画される。
| visual | 型 | 必須 |
|---|---|---|
| `step` | number | 任意（タイトルの番号。省略時 0） |
| `screenshot` | string | ✅（`screenshots/` 内のファイル名） |
| `note` | string | 任意（画像下キャプション） |
| `imgH` / `imgW` / `imgY` | number | 任意（画像寸法の上書き） |
| `arrows[]` | `{x, y, rotate?}` | 任意（赤い矢印） |
| `rectAnnotations[]` | `{x, y, w, h}` | 任意（赤枠） |
| `textAnnotations[]` | `{text, x, y, w, h, fontSize}` | 任意（赤字注釈） |
| `overlayImages[]` | `{asset, x, y, w, h}` | 任意（`assets/` 内画像の重ね） |

### `risks` — 2カラム（左:リスク / 右:対策）
| visual | 型 | 必須 |
|---|---|---|
| `risks_heading` | string | ✅ |
| `risks[]` | `{heading, body, cites?[]}` | ✅ |
| `solutions_heading` | string | ✅ |
| `solutions[]` | `{heading, body, cites?[], footnote?}` | ✅ |
| `banner` | string | 任意（下部バナー） |

### `checklist` — 2x2 カード（事前準備向け）
| visual | 型 | 必須 |
|---|---|---|
| `subtitle` | string | 任意 |
| `items[]` | `{title, desc, url?, warning?}` | ✅ |

### `closing` — タイムライン＋締めメッセージ
| visual | 型 | 必須 |
|---|---|---|
| `timeline[]` | `{time, duration, desc}` | ✅ |
| `closing_message` | string | ✅ |
| `closing_sub` | string | 任意 |
| `conference` | string | 任意 |

### `references` — 文献一覧（自動生成）
`visual` 不要。`cite()` で参照された全文献を APA 形式で2カラム表示する。
**引用が1件も無い場合、このスライドは生成されない。**

### `statement` — 全面の大きな宣言（章扉・締めの一言）
| visual | 型 | 必須 |
|---|---|---|
| `quote` | string | 任意（省略時は `title` を使用） |
| `eyebrow` | string | 任意（小見出し） |
| `attribution` | string | 任意（帰属） |

### `number-cards` — 汎用 2-4 番号カードグリッド
| visual | 型 | 必須 |
|---|---|---|
| `items[]`（or `cards[]`） | `{heading, body, detail?, footer?}` | ✅（2-4件） |
| `y` / `h` / `gap` / `color` | number / string | 任意（配置・色の上書き） |

---

## 一点物図版（新しい layout）の追加手順

1. `lib/render.ts` のディスパッチャに `case "my-figure": return renderMyFigure(pres, s);` を足す。
2. `renderMyFigure(pres, s)` を実装する。データは `s.visual` から読む（`const v = s.visual ?? {}`）。
   `addContentSlide(pres, s.title)` で標準クロームを得て、`addNotes(slide, s)` でノートを付ける。
3. `lib/validate.ts` の `SCHEMAS` に `"my-figure": { top: {...}, visual: {...} }` を追加。
4. `slides.yaml` に `layout: my-figure` でエントリを足す。**`generate.ts` も `id` 配線も触らない。**

図版コードは「名前付きの再利用可能な layout」として `lib/render.ts` に中央集約され、
著者の編集・並べ替えは `slides.yaml` に残る。
