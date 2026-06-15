#!/bin/bash
# ============================================================================
# set-video-autoplay.sh — PPTX 内の全動画を「スライド表示で自動再生」に設定する。
#
#   方式: Windows PowerPoint(COM) に TimeLine.MainSequence.AddEffect(MediaPlay,
#         WithPrevious) を全 media shape へ付与させ、保存。PowerPoint が
#         正しい <p:timing> を書き、ついでに PptxGenJS の重複 cNvPr id も再採番する。
#   理由: 手書き XML は壊れやすい／spid 重複問題がある。COM に書かせるのが確実。
#
#   使い方:  bash set-video-autoplay.sh <pptx_file>
#   注意:    対象は Windows から見えるパス（/mnt/h など）に置くこと。/tmp は不可な場合あり。
# ============================================================================
set -euo pipefail

PPTX="${1:-}"
if [[ -z "$PPTX" || ! -f "$PPTX" ]]; then
  echo "Usage: bash set-video-autoplay.sh <pptx_file>" >&2
  exit 1
fi

PPTX_WIN=$(wslpath -w "$(realpath "$PPTX")")
echo "=== set-video-autoplay ==="
echo "対象: $PPTX"

PS_SCRIPT=$(cat << PSEOF
\$ErrorActionPreference = "Stop"
\$path = "${PPTX_WIN}"
\$ppt = \$null; \$pres = \$null
# MsoAnimEffect.msoAnimEffectMediaPlay = 83 / MsoAnimTriggerType.msoAnimTriggerWithPrevious = 2
# MsoShapeType.msoMedia = 16 / PpMediaType.ppMediaTypeMovie = 3
try {
  \$ppt = New-Object -ComObject PowerPoint.Application
  \$pres = \$ppt.Presentations.Open(\$path, 0, 0, 0)   # ReadOnly=0, Untitled=0, WithWindow=0
  \$count = 0; \$slideNo = 0
  foreach (\$slide in \$pres.Slides) {
    \$slideNo++
    # 冪等化: 既存の MainSequence を一掃してから付与（再実行で重複しない）
    \$seq = \$slide.TimeLine.MainSequence
    while (\$seq.Count -gt 0) { \$seq.Item(1).Delete() }
    foreach (\$shape in \$slide.Shapes) {
      if (\$shape.Type -eq 16) {
        \$isMovie = \$false
        try { if (\$shape.MediaType -eq 3) { \$isMovie = \$true } } catch { \$isMovie = \$true }
        if (\$isMovie) {
          try {
            \$null = \$seq.AddEffect(\$shape, 83, 0, 2)   # 自動再生（WithPrevious）
            try { \$shape.AnimationSettings.PlaySettings.LoopUntilStopped = -1 } catch {}  # ループ
            \$count++
          } catch {
            Write-Host ("warn slide {0}: {1}" -f \$slideNo, \$_.Exception.Message)
          }
        }
      }
    }
  }
  \$pres.Save()
  Write-Host ("autoplay set on {0} media shape(s)" -f \$count)
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
