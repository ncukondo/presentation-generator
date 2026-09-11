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
| `transition` | 任意 | このスライドに**入るとき**の切り替え効果。省略時は `defaults.transition`。[後述](#transition--スライド切り替え効果morph-対応) |
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
| `items[]` | `string`（タイトルのみ）or `{title, desc?, key?}` | ✅（`key` は morph 用。直後の `section` の `visual.key` と揃える） |

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
| `key` | string | 任意（morph 用。直前の `agenda` の `items[].key` と揃えると、目次の行が章番号・題名へ飛ぶ） |

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
| `steps[]` | `string`（タイトルのみ）or `{title, icon?}` | ✅ |
| `note` | string | 任意（下部キャプション） |

- `steps[].icon` … 番号の横に内容を表すアイコンを添える。MDI 名（例 `book-search-outline`）
  または `lib/icons.ts` のキー。**既定アイコンは無い**（内容に合わないアイコンは装飾ノイズ）。
  内容の比喩になるアイコンが見つからないステップは省略して番号だけにする。

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
（`tools/build.sh` 参照）。上映用の**自動再生＋ループは既定で有効**。PptxGenJS はクリック再生でしか
出力しないので、`lib/postprocess.ts` が保存直前に PowerPoint と同じ形の `<p:timing>` を書き込む
（transition と同じ後処理。PowerPoint 不要・冪等）。

| visual | 型 | 必須 |
|---|---|---|
| `video` | string | ✅（`DEMO_DIR` からの相対パス） |
| `poster` | string | 任意（省略時は動画名から推定） |
| `autoplay` | boolean | 任意（既定 `true`。スライド表示で自動再生。`false` でクリック再生） |
| `loop` | boolean | 任意（既定 `true`。スライドを離れるまで繰り返す） |
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

## transition — スライド切り替え効果（morph 対応）

PptxGenJS には切り替え効果の API が無いので、`generate.ts` が保存直前に PPTX 内の slide XML へ
`<p:transition>` を注入する（`lib/transitions.ts`）。宣言は `slides.yaml` だけで完結する。

```yaml
defaults:
  transition: fade            # 全スライドの既定（省略時 none）

slides:
  - id: agenda
    transition: none          # 既定を打ち消す
  - id: background
    transition: morph         # 短縮形（type だけ）
  - id: features
    transition:               # 詳細形
      type: morph             # none / morph / fade / push / wipe
      option: byObject        # morph 専用: byObject / byWord / byChar
      duration: 0.8           # 秒（省略時 morph 1.0、それ以外 0.5）
  - id: results
    transition: { type: push, direction: left }   # push / wipe 専用: left / right / up / down
```

- 効果は**そのスライドに入るとき**に再生される（PowerPoint と同じ意味）。
- `option` / `direction` を該当しない type に書くと警告（無視される）。未知の type はエラー。
- **morph は PowerPoint 2019 / Microsoft 365 のスライドショーでのみ再生**される。他アプリでは
  フォールバックのフェードになる。`bun run video` の MP4 は静止 PNG から作るので反映されない。
- `tools/set-video-autoplay.sh` などで PowerPoint が再保存しても効果は保持される。

### morph の対応付け `key`

morph は前後のスライドで「同じ図形」を見つけ、位置・大きさ・色の差を動きにする。PowerPoint は
名前が `!!` で始まる図形を**名前一致で必ず対応付ける**ので、`visual` の要素に `key` を書くと、
レンダラが `!!key` という図形名で描く。前後のスライドで同じ `key` を持つ要素は、layout が
違っても 1 つの図形として扱われる。

**動きが見えるのは「見た目が同じ要素が、場所や大きさを変えて残る」ときだけ。** 文字なら同じ
文字列、図形なら同じ塗り、画像なら同じ画像を両方のスライドに置く。片方にしか無い要素は
フェードで消える／現れるだけなので、白いカード枠を塗りの無いテキストボックスへ対応付けても
ほぼフェードにしか見えない。

見本は「目次の行 → 章扉」。目次の連番と題名が、章扉の大きな番号と題名へ移動しながら拡大する
（サンプルデッキの `agenda` → `section-background`）。

```yaml
  - id: agenda
    layout: agenda
    visual:
      items:
        - key: background     # ← 丸=!!background.badge / 番号=.num / 題名=!!background
          title: 背景と目的
        - key: methods
          title: 方法
  - id: section-background
    layout: section
    title: 背景と目的         # agenda 側と同じ文字列にする（違うと文字はフェード）
    transition: morph
    visual:
      key: background         # ← 番号=!!background.num / 題名=!!background
      number: "1"             # agenda の連番と同じ文字列にする
```

- 共通クローム（背景 `!!bg` / タイトルバー `!!titlebar` / 題名 `!!title` / 下線 `!!rule`）は
  `addContentSlide` が自動で名前を付ける。`section` の全面背景も `!!bg` なので、本文 → 章扉の
  morph では背景色が滑らかに変わる。本文スライド同士では背景が静止し題名だけ差し替わる。
- 複数図形からなる要素はレンダラが接尾辞で配る（例 number-cards: 枠 `!!k`、縦帯 `.bar`、丸 `.badge`、
  番号 `.num` / アイコン `.icon`、見出し `.heading`、本文 `.body`）。接尾辞は各レンダラの冒頭コメントを参照。
- `key` の書式は英数字と `_` `-`（`.` は接尾辞用に予約）。`bg` / `titlebar` / `title` / `rule` は
  クロームに予約済み。同一スライド内の重複はエラー。
- `key` を持つ layout: `agenda`（items）、`section`（`visual.key`）、`number-cards`（items/cards）、
  `steps`（steps）、`data-flow`（lanes）、`bullets`（`visual.key` = 本文）、
  `split`（`visual.key` = テキスト列、`visual.image_key` = 画像＋caption）。
  他の layout に足すときは、要素に `key` を追加し `morphOpt(key, part)` を各 `add*` に spread する
  （`lib/validate.ts` の SCHEMAS にも `key: MORPH_KEY` を足す）。

---

## 一点物図版（新しい layout）の追加手順

1. `lib/render.ts` のディスパッチャに `case "my-figure": return renderMyFigure(pres, s);` を足す。
2. `renderMyFigure(pres, s)` を実装する。データは `s.visual` から読む（`const v = s.visual ?? {}`）。
   `addContentSlide(pres, s.title)` で標準クロームを得て、`addNotes(slide, s)` でノートを付ける。
3. `lib/validate.ts` の `SCHEMAS` に `"my-figure": { top: {...}, visual: {...} }` を追加。
4. `slides.yaml` に `layout: my-figure` でエントリを足す。**`generate.ts` も `id` 配線も触らない。**

図版コードは「名前付きの再利用可能な layout」として `lib/render.ts` に中央集約され、
著者の編集・並べ替えは `slides.yaml` に残る。
