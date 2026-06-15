#!/bin/bash
# ============================================================================
# export-pdf.sh — PPTX を PDF 化する（隠しスライド＝appendix は出力しない）。
#
#   方式: Windows PowerPoint(COM) の ExportAsFixedFormat を使用。
#         第7引数 PrintHiddenSlides=msoFalse(0) で非表示スライドを除外。
#         元 PPTX は read-only で開き、一切変更・保存しない（appendix は残る）。
#   理由: 受講生配布用PDFは本編のみ。付録(質疑用・非表示)は配布物に含めない。
#
#   使い方:  bash export-pdf.sh <pptx_file> [出力pdfパス]
#   既定の出力: 入力と同じディレクトリの「<basename>.pdf」
#   注意:    対象は Windows から見えるパス（/mnt/h など）に置くこと。
# ============================================================================
set -euo pipefail

PPTX="${1:-}"
if [[ -z "$PPTX" || ! -f "$PPTX" ]]; then
  echo "Usage: bash export-pdf.sh <pptx_file> [out.pdf]" >&2
  exit 1
fi

PPTX_ABS="$(realpath "$PPTX")"
OUT="${2:-${PPTX_ABS%.pptx}.pdf}"
PPTX_WIN=$(wslpath -w "$PPTX_ABS")
# 出力先ディレクトリは存在前提（入力と同じ場所）。Windowsパスへ。
OUT_DIR="$(dirname "$OUT")"; OUT_BASE="$(basename "$OUT")"
OUT_WIN=$(wslpath -w "$(realpath "$OUT_DIR")")"\\${OUT_BASE}"

echo "=== export-pdf (隠しスライド除外) ==="
echo "入力: $PPTX"
echo "出力: $OUT"

PS_SCRIPT=$(cat << PSEOF
\$ErrorActionPreference = "Stop"
\$src = "${PPTX_WIN}"
\$pdf = "${OUT_WIN}"
\$ppt = \$null; \$pres = \$null
# 方式: 編集可能で開き、非表示(appendix)スライドを削除してから SaveAs で PDF 化。
#       元 pptx は SaveAs(pptx) しないので不変。COM の ExportAsFixedFormat は
#       PowerShell 遅延バインドで引数型エラーになりやすいため SaveAs を採用。
# ppSaveAsPDF = 32 / SlideShowTransition.Hidden の msoTrue = -1
try {
  \$ppt = New-Object -ComObject PowerPoint.Application
  \$pres = \$ppt.Presentations.Open(\$src, 0, 0, 0)   # ReadOnly=0, Untitled=0, WithWindow=0
  \$total = \$pres.Slides.Count
  \$hidden = 0
  for (\$i = \$pres.Slides.Count; \$i -ge 1; \$i--) {
    \$sl = \$pres.Slides.Item(\$i)
    if (\$sl.SlideShowTransition.Hidden -eq -1) { \$sl.Delete(); \$hidden++ }
  }
  \$pres.SaveAs(\$pdf, 32)
  \$pres.Saved = \$true
  Write-Host ("PDF出力完了: 全{0}枚中 非表示{1}枚を除外 -> {2}枚" -f \$total, \$hidden, (\$total - \$hidden))
} catch {
  Write-Host ("Error: {0}" -f \$_.Exception.Message)
  exit 1
} finally {
  if (\$pres -ne \$null) { \$pres.Close() | Out-Null; [System.Runtime.Interopservices.Marshal]::ReleaseComObject(\$pres) | Out-Null }
  if (\$ppt -ne \$null) { \$ppt.Quit(); [System.Runtime.Interopservices.Marshal]::ReleaseComObject(\$ppt) | Out-Null }
  [System.GC]::Collect(); [System.GC]::WaitForPendingFinalizers()
}
PSEOF
)

powershell.exe -NoProfile -NonInteractive -Command "$PS_SCRIPT"
echo "=== done ==="
