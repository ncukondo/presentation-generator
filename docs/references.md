# 文献の扱い（2つの方式）

引用キー（pandoc citekey、例 `qureshi-2023`）から文献表記を作る方法が2つある。
どちらも同じローカル文献ツール [`ref`](https://github.com/ncukondo/reference-manager/) を使うが、
**いつ `ref` を呼ぶか**が違う。用途に応じて選ぶ（併存可）。

| | `lib/cite.ts`（既存） | `lib/refs.ts` + `gen-refs`（追加） |
|---|---|---|
| 呼ぶ時 | **ビルド毎**に `ref` を起動 | 事前に1回だけ。ビルドは**キャッシュを読むだけ** |
| `ref` 依存 | ビルドに必須 | ビルドは**非依存**（キャッシュがあれば動く） |
| 決定性 | 文献ライブラリの状態に依存 | キャッシュが正本＝**再現可能** |
| 出力 | APA インテキスト `(Qureshi et al., 2023)` ＋ APA フル | 「著者. 誌. 年;巻(号):頁.」（表題省略の帰属形式） |
| 向く場面 | 編集中・本文中の都度引用 | 配布物・CI・`ref` を入れたくない環境での確定ビルド |

## 引用キーの書き場所（両方式共通）

`slides.yaml` の以下から収集される（`@` 接頭辞は任意）:

- `cites:`（配列）/ `cite:`（文字列）フィールド … 例 `cites: ["qureshi-2023", "@flemyng-2025"]`
- 本文中の pandoc 引用 … `[@qureshi-2023]` / `(@qureshi-2023)` / 単独 `@qureshi-2023`
  - メールや URL の `@`（`user@host`・`x.com/@handle`）は誤検出しない

## deterministic 方式の使い方

```bash
bun run gen-refs          # slides.yaml の引用を集約 → ref export → assets/references.json
```

- 引用を増減したら再実行する（`assets/references.json` は生成物＝`.gitignore` 済み）。
- 別ファイルを読むときは `SLIDES_YAML=path/to.yaml bun run gen-refs`。
- ページ側は `loadReferenceEntries()`（`lib/refs.ts`）でキャッシュを読み、文献一覧スライドに流す。
  既定の `pages/slide08-references.ts` は `lib/cite.ts` を使う実装のままなので、
  deterministic 方式に切り替えたい場合だけ `loadReferenceEntries()` 参照に差し替える。
- `ref` 不在/失敗時は `gen-refs` が非0終了する（既存キャッシュを残す運用なら CI で分岐させる）。

## ロジックの所在

- 収集 + CSL-JSON 整形 + キャッシュ読込 … `lib/refs.ts`
- CLI（収集→`ref export`→書き出し） … `tools/gen-refs.ts`（`bun run gen-refs`）
