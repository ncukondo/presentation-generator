# テーマ（配色・フォント）の準備

スライド作成ワークフローの「**内容に合った配色・スタイルテーマを準備**」フェーズの仕組み。
配色は `slides.yaml` の `theme:` ブロックで一元指定し、`lib/theme.ts` が解決して `C`（カラー）/ `FONT*`（フォント）として全レンダラ（`lib/render.ts`）に供給する。

役割名（`C.primary` 等）で参照するため、**テーマを差し替えてもレイアウトコードは無改修**。

---

## 指定方法（3通り）

`slides.yaml` 先頭の `theme:` ブロックに書く。解決の優先順は **preset → primary(シード) → デフォルト(slate)**、そのうえで**フィールド単位の上書き**が最優先で乗る。

### 1. プリセットを選ぶ（最も手軽）

```yaml
theme:
  preset: slate       # slate(学術既定) / blue / warm / forest
```

| preset | 雰囲気 | 用途 | Primary | Accent |
|--------|--------|------|---------|--------|
| `slate`  | モノクロ＋1アクセント | **既定**。学術・データ密な発表向け。配色を触らなくても破綻しない | `#37474F` | `#FF7043` |
| `blue`   | 信頼感のある青 | 汎用・カラフルに見せたい時 | `#1E88E5` | `#FF9800` |
| `warm`   | コーラル/アンバーの暖色 | 親しみ・温かみ | `#E5533D` | `#FFB300` |
| `forest` | 落ち着いたグリーン | 環境・生命系 | `#2E7D32` | `#F9A825` |

### 2. シード色から自動生成（preset を消し primary を指定）

`primary` 1色（＋任意で `accent`）から、light 派生・pastel カード背景・7つの step カラーを色理論で導出する。step カラーは白背景で 3:1 以上のコントラストになるよう自動補正される。

```yaml
theme:
  primary: "6A1B9A"   # この1色を起点に残りを生成（accent は補色を自動採用）
  # accent: "00C853"  # accent を明示する場合
```

### 3. 個別フィールドを上書き（preset / シードの上に重ねる）

任意の Palette キー（`primary` `accent` `text` `warmBg` `step1`…`cardBlue`… など）を hex で上書きできる。

```yaml
theme:
  preset: blue
  accent: "00C853"    # blue をベースに accent だけ緑へ
```

### フォントの上書き（任意）

```yaml
theme:
  preset: blue
  fonts: { jp: "Meiryo", en: "Arial" }
```

---

## Palette のキー

`lib/themes.ts` の `Palette` 型（= `lib/theme.ts` の `C` の形）。値はすべて `#` なしの 6 桁 hex。

- 主役: `primary` `primaryLight` `accent` `accentLight`
- 中立: `white` `offWhite` `warmBg` `lightGray` `midGray` `darkGray` `text` `black`
- カテゴリ: `step1`…`step7`（区別が意味を持つ要素専用）
- カード地: `cardBlue` `cardGreen` `cardOrange` `cardPurple` `cardCyan`
- チャート: `chartBlue` `chartGreen` `chartOrange`

役割の使い分けは `docs/design-principles.md` §1 が権威源。

---

## 配色を決めるときの指針

- **Primary を主役に**（面積 60–70%）。Accent は CTA/重要告知だけに絞る（1スライド最大1箇所）。
- 並列項目は**順番で色を変えない**。`step1..7` は「区別が意味を持つ」時だけ使う。
- 暗い背景に白以外の文字を置かない。生成した step カラーは白背景前提で補正済み（暗背景での白文字とは別物）。
- 新しい preset を足したい時は `lib/themes.ts` の `presets` に完成パレットを1つ追加するだけ。

---

## 確認

テーマを変えたら `bun run build` し、`output_images/*.png` でタイトルバー・カード・step バッジ等が一貫して再配色されているか目視する。不正な preset 名や hex は `[theme]` 警告が出て既定にフォールバックする（ビルドは止めない）。
