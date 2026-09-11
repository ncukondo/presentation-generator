#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# WSL マウントドライブ (Google Drive 等) 上では bun がシンボリックリンク等の
# 問題でハングするため、/tmp にコピーしてビルドし成果物を戻す。
#
# Usage:
#   tools/build.sh            # PPTX 生成のみ -> presentation.pptx
#   tools/build.sh --png      # PPTX 生成 + PNG 変換 (要 PowerPoint/WSL)
# ---------------------------------------------------------------------------
set -euo pipefail

SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="/tmp/presentation-gen-build"

echo "[build] src : $SRC_DIR"
echo "[build] tmp : $BUILD_DIR"

mkdir -p "$BUILD_DIR"
rsync -a --delete \
  --exclude 'node_modules' \
  --exclude 'materials' \
  --exclude 'output_images' \
  --exclude '.git' \
  "$SRC_DIR/" "$BUILD_DIR/"

cd "$BUILD_DIR"
[ -d node_modules ] || bun install
# デモ動画/ポスターは slides/ の外（プロジェクト直下 demos/output/）にあり /tmp に
# コピーされないため、絶対パスを DEMO_DIR で渡して generate 時に読み込ませる。
export DEMO_DIR="${DEMO_DIR:-$SRC_DIR/../demos/output}"
echo "[build] demo: $DEMO_DIR"
bun run generate

cp "$BUILD_DIR/presentation.pptx" "$SRC_DIR/presentation.pptx"
echo "[build] -> $SRC_DIR/presentation.pptx"

if [ "${1:-}" = "--png" ]; then
  bun run screenshot
  mkdir -p "$SRC_DIR/output_images"
  cp "$BUILD_DIR"/output_images/*.png "$SRC_DIR/output_images/" 2>/dev/null || true
  echo "[build] PNG -> $SRC_DIR/output_images/"
fi

# 上映用の「自動再生(WithPrevious)＋ループ」は generate 時に lib/postprocess.ts が
# <p:timing> として書き込む（demo layout の visual.autoplay / loop、既定 true）。
# 以前の PowerPoint(COM) 経由の付与は退避策として残す: AUTOPLAY_COM=1 で実行。
if [ "${AUTOPLAY_COM:-0}" = "1" ] && command -v powershell.exe >/dev/null 2>&1; then
  echo "[build] set-video-autoplay ..."
  bash "$SRC_DIR/tools/set-video-autoplay.sh" "$SRC_DIR/presentation.pptx" \
    || echo "[build] WARN: autoplay 付与に失敗（PowerPoint を閉じて再実行 / AUTOPLAY=0 で抑止）"
fi
