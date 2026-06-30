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

> **設計方針（重複の回避）**：`subtitle` / `banner` / `note` / `eyebrow` のような
> **補足・装飾パーツは必須にしない**。必須にすると、書くことが無いときに題名の言い換え等
> 「無意味な重複コンテンツ」を誘発するため。省略時はレンダラが残り要素を詰めて配置する。

### `title` — タイトルスライド
| visual | 型 | 必須 |
|---|---|---|
| `subtitle` | string | 任意（省略可。書くこと前提にしない） |
| `presenter` | string | ✅ |

### `agenda` — 目次・アウトライン（番号付き縦並び）
3-7 項目向け。番号バッジ＋章タイトル（＋任意の補足）を縦に並べる。
| visual | 型 | 必須 |
|---|---|---|
| `items[]` | `string`（タイトルのみ）or `{title, desc?}` | ✅ |

### `bullets` — タイトル＋階層箇条書き本文
学術発表で最頻出の素の箇条書き。序論・考察・まとめ等に。`level: 1` で字下げのサブ項目。
| visual | 型 | 必須 |
|---|---|---|
| `subtitle` | string | 任意 |
| `items[]` | `string` or `{text, level?(0/1), cites?[], bold?}` | ✅ |
| `note` | string | 任意（下部キャプション） |

### `section` — 章扉・セクション区切り
深い primary 全面＋単一アクセント＋大きな章番号＋章タイトル。`statement`（引用調）とは住み分け。
| visual | 型 | 必須 |
|---|---|---|
| `number` | string / number | 任意（大きな章番号。例 `"03"`） |
| `eyebrow` | string | 任意（小見出し。例 `SECTION`） |
| `subtitle` | string | 任意（章の補足） |

### `evidence` — 2カラム（左:特徴リスト / 右:エビデンスカード）
| visual | 型 | 必須 |
|---|---|---|
| `subtitle` | string | 任意 |
| `features[]` | string[] | ✅ |
| `evidence_heading` | string | 任意（右カラムの見出し） |
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

### `statement` — 全面の大きな宣言（引用・締めの一言）
※ 章の区切り（番号付き章扉）は `section` を使う。`statement` は引用・キーメッセージ向け。
| visual | 型 | 必須 |
|---|---|---|
| `quote` | string | 任意（省略時は `title` を使用） |
| `eyebrow` | string | 任意（小見出し） |
| `attribution` | string | 任意（帰属） |

### `number-cards` — 汎用 2-4 番号カードグリッド（旧 `grid` を統合）
旧 `grid`（3列固定＋subtitle＋cites）はこの layout に一本化された。`grid` は別名として残るが
非推奨（同じレンダラにルートされる）。新規は `number-cards` を使う。
| visual | 型 | 必須 |
|---|---|---|
| `subtitle` | string | 任意（中央見出し。指定時はカードが下がる＝旧 grid の配置） |
| `badge` | `"number"`（既定）/ `"none"` | 任意（カード上の丸バッジの扱い） |
| `items[]`（or `cards[]`） | `{heading, body, detail?, cites?[], footer?, icon?}` | ✅（2-4件） |
| `y` / `h` / `gap` / `color` | number / string | 任意（配置・色の上書き） |

**バッジ（カード上の丸）の3モード** — 連番が無意味になる場合に省略/差し替え可：
- 既定 … `01` `02` … の連番
- `badge: none` … 番号を**省略**（バッジ帯を取り除きカードが上に詰まる）
- `items[].icon` … そのカードだけ番号を**アイコンに差し替え**。値は MDI 名（例 `rocket-launch-outline`）
  または `lib/icons.ts` のセマンティックキー（例 `rocket` / `shieldCheck` / `lightbulb`）。
  1枚でも `icon` があるカードはアイコン、無いカードは（`badge: none` でなければ）連番のまま。

### `figure` — 大きな図1枚＋キャプション＋引用（結果の図版用）
`assets/` 内の画像をコンテンツ領域いっぱいにアスペクト比維持で配置。`evidence.figure`（小さい補足
画像）とは別用途。
| visual | 型 | 必須 |
|---|---|---|
| `image` | string | ✅（`assets/` 内のファイル名） |
| `subtitle` | string | 任意 |
| `caption` | string | 任意（画像下キャプション） |
| `cite` | string | 任意（APA インテキスト引用を併記） |

### `split` — 汎用2カラム（テキスト ⇔ 図）
左にテキスト/箇条書き、右に図（`imageSide: left` で左右反転）。「図と説明を横に並べる」最頻出形。
| visual | 型 | 必須 |
|---|---|---|
| `items[]` | `string` or `{text, level?, cites?[], bold?}` | ✅（テキスト側、`bullets` と同形式） |
| `image` | string | 任意（`assets/` 内のファイル名） |
| `imageSide` | `"right"`（既定）/ `"left"` | 任意 |
| `subtitle` / `caption` / `note` | string | 任意 |

### `big-stat` — 巨大数値の強調（KPI・統計値 1-3個）
「95%」級の大きな数値＋ラベルを 1-3 個並べる。`value` は単位込みで引用符付き推奨（例 `"68%"`）。
| visual | 型 | 必須 |
|---|---|---|
| `stats[]` | `{value, label?, sub?}` | ✅（1-3件。`value` のみ必須） |
| `subtitle` | string | 任意 |
| `note` | string | 任意（下部キャプション） |

### `chart` — データグラフ（PowerPoint で編集できるネイティブグラフ）
`addChart` でネイティブ図表を埋め込む。系列の色はテーマの `step1..7` を自動割当てするので、
`theme:` を差し替えても配色が追従する。
| visual | 型 | 必須 |
|---|---|---|
| `chartType` | string | 任意（`bar`(縦棒・既定) / `barh`(横棒) / `line` / `area` / `pie` / `doughnut`） |
| `categories[]` | string[] | ✅（X 軸ラベル。pie/doughnut では各スライスのラベル） |
| `series[]` | `{name?, values[]}` | ✅（`values` は number[]。pie/doughnut は先頭 series のみ使用） |
| `subtitle` | string | 任意（タイトル下の中央見出し） |
| `note` | string | 任意（下部キャプション） |
| `showValue` | boolean | 任意（棒/線/面でデータ値ラベルを表示。既定 false） |

```yaml
visual:
  chartType: bar
  categories: ["A 施設", "B 施設", "C 施設"]
  series:
    - { name: 介入前, values: [42, 55, 38] }
    - { name: 介入後, values: [68, 72, 61] }
```

### `table` — 表組み（PowerPoint で編集できるネイティブ表）
`addTable` でネイティブ表を描く。header 行は primary 背景＋白字、本文は白/オフ白の交互ストライプ、
先頭列は行ラベルとして太字＋左寄せになる。
| visual | 型 | 必須 |
|---|---|---|
| `headers[]` | string[] | 任意（先頭行。指定時は header スタイル） |
| `rows[][]` | string[][] | ✅（各行＝セル文字列の配列。列数は揃える） |
| `subtitle` | string | 任意（タイトル下の中央見出し） |
| `colW[]` | number[] | 任意（列幅 inch の配列。合計が `CONTENT_W`≈12.13 になるよう調整） |
| `note` | string | 任意（下部キャプション） |

```yaml
visual:
  headers: ["項目", "Free", "Pro"]
  rows:
    - ["月額", "0 円", "1,500 円"]
    - ["SLA",  "—",    "99.5%"]
```

---

## 図版・メディア系 layout

スライド面に図やメディアを置くための layout 群。補足パーツ（`eyebrow` / `note` / `subtitle` 等）は
いずれも任意（省略時はレンダラが詰める）。引用は `cite`（単一）/ `cites`（配列）で References に自動収集。

### `demo` — 録画済みデモ動画の埋め込み
短縮版 mp4 を主役に1枚。ポスター画像（再生前の見た目）は `poster` 省略時に動画名から推定
（`xxx-short.mp4` → `xxx.png`）。動画/ポスターのアスペクト比はポスターPNGの実寸から自動算出する
（外部ツール不要）。動画は `slides/` の外に置けるよう、ビルドが環境変数 `DEMO_DIR` に絶対パスを渡す
（`tools/build.sh` 参照）。上映用の自動再生＋ループはビルド末尾の `set-video-autoplay.sh` が付与する。

| visual | 型 | 必須 |
|---|---|---|
| `video` | string | ✅（`DEMO_DIR` からの相対パス） |
| `poster` | string | 任意（省略時は動画名から推定） |
| `eyebrow` | string | 任意（章タグ・右上に小さく） |
| `points` | string[] | 任意（動画下の要点） |
| `tryit` | string | 任意（聴衆が手元で試す実プロンプト） |
| `tryit_label` | string | 任意（既定「お手元でも試せます」） |
| `tryit_qr` | string | 任意（QR画像パス） |
| `cite` / `cites` | string / string[] | 任意 |

### `section-recap` — 章のふりかえり（手法の使いどころ比較）
章末で複数の手法を「特性・向く場面・限界」で横並び比較する。

| visual.methods[] | 型 | 必須 |
|---|---|---|
| `name` | string | ✅ |
| `fit` | string | ✅（向く場面） |
| `limit` | string | ✅（限界） |
| `level` / `trait` | string | 任意 |

### `data-flow` — データの流れ（手元 ↔ クラウド）
「貼ったデータがどこへ行くか」をレーンごとに図示。`tone` で各レーンの強調（注意/安全）を出す。

| visual.lanes[] | 型 | 必須 |
|---|---|---|
| `name` `home` `cloud` `flow` `flow_label` `note` `tone` | string | ✅ |

### `spectrum` — 連続的な段階（グラデーション帯）
1次元の段階性（薄→濃）を停留点で示す。カード3枚より「連続している」ことを見せたい時に。

| visual | 型 | 必須 |
|---|---|---|
| `stops[].heading` / `stops[].body` | string | ✅ |
| `subtitle` / `axis` | string | 任意 |
| `stops[].icon` / `stops[].cites` | string / string[] | 任意 |

### `usage-bars` — 横棒グラフ
カテゴリ別の数値（％など）を横棒で比較。カード多用の単調さを図示で緩和する。

| visual | 型 | 必須 |
|---|---|---|
| `bars[].label` / `bars[].value` | string / number | ✅ |
| `subtitle` / `banner` / `footnote` | string | 任意 |
| `bars[].cite` | string | 任意 |

### `compare-paths` — 2つの経路の対比
同じ起点（`source`）から分かれる2つの道を左右に並べ、違いと結論を示す。

| visual | 型 | 必須 |
|---|---|---|
| `source` | string | ✅ |
| `left` / `right`（`{name, note}`） | object | ✅ |
| `conclusion` | string | ✅ |
| `eyebrow` / `middle` / `diffs_heading` / `diffs` / `cite` / `cites` | — | 任意 |

### `nested-layers` — 入れ子の2層
「外側＝何を／内側＝どう」のような包含関係の2層を同心で示す。

| visual | 型 | 必須 |
|---|---|---|
| `outer` / `inner`（`{label, desc, tag?}`） | object | ✅ |
| `eyebrow` / `note` / `cite` / `cites` | — | 任意 |

### `agent-loop` — エージェントの反復ループ図
「指示 → [考える→道具→確かめる] の繰り返し → 成果物」を1枚で。動画の前置き説明に。

| visual | 型 | 必須 |
|---|---|---|
| `input`（`{label, example}`） | object | ✅ |
| `output`（`{label, items[]}`） | object | ✅ |
| `steps[]`（`{name, body, icon?}`） | object[] | ✅ |
| `hub` / `hub_sub` / `loop_label` / `eyebrow` / `note` / `cite` / `cites` | — | 任意 |

### `self-intro` — 自己紹介（図版サムネ横並び）
ほぼ文字なしで、画像（論文サムネ等）を実寸比のまま横並び・中央寄せ。`assets/` の画像を使う。

| visual | 型 | 必須 |
|---|---|---|
| `papers[].image` | string | ✅（`assets/` 相対） |
| `papers[].caption` | string | 任意 |
| `subtitle` / `footnote` | string | 任意 |

---

## 一点物図版（新しい layout）の追加手順

1. `lib/render.ts` のディスパッチャに `case "my-figure": return renderMyFigure(pres, s);` を足す。
2. `renderMyFigure(pres, s)` を実装する。データは `s.visual` から読む（`const v = s.visual ?? {}`）。
   `addContentSlide(pres, s.title)` で標準クロームを得て、`addNotes(slide, s)` でノートを付ける。
3. `lib/validate.ts` の `SCHEMAS` に `"my-figure": { top: {...}, visual: {...} }` を追加。
4. `slides.yaml` に `layout: my-figure` でエントリを足す。**`generate.ts` も `id` 配線も触らない。**

図版コードは「名前付きの再利用可能な layout」として `lib/render.ts` に中央集約され、
著者の編集・並べ替えは `slides.yaml` に残る。
