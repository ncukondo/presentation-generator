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
bun run generate

cp "$BUILD_DIR/presentation.pptx" "$SRC_DIR/presentation.pptx"
echo "[build] -> $SRC_DIR/presentation.pptx"

if [ "${1:-}" = "--png" ]; then
  bun run screenshot
  mkdir -p "$SRC_DIR/output_images"
  cp "$BUILD_DIR"/output_images/*.png "$SRC_DIR/output_images/" 2>/dev/null || true
  echo "[build] PNG -> $SRC_DIR/output_images/"
fi
