#!/usr/bin/env python3
"""make-handout.py — 1up スライドPDF を 6枚/1ページ（2列×3行・A4縦）のハンドアウトPDFに変換。

PowerPoint の ExportAsFixedFormat(ハンドアウト)は PowerShell 遅延バインドで型エラーに
なるため、PowerPoint がレンダリングした 1up PDF（=画質はネイティブ）を入力に、
PyMuPDF で 6面付けする。各スライド(16:9)はセル内にアスペクト比を保って配置・薄枠つき。

使い方: python3 make-handout.py <input_1up.pdf> [output.pdf] [cols] [rows]
既定: 2列×3行（6枚/ページ）、出力 <input>_ハンドアウト_6up.pdf
"""
import sys, fitz  # PyMuPDF

src_path = sys.argv[1]
COLS = int(sys.argv[3]) if len(sys.argv) > 3 else 2
ROWS = int(sys.argv[4]) if len(sys.argv) > 4 else 3
per_page = COLS * ROWS
out_path = sys.argv[2] if len(sys.argv) > 2 else f"{src_path.rsplit('.pdf',1)[0]}_ハンドアウト_{per_page}up.pdf"

A4_W, A4_H = 595.28, 841.89          # A4 portrait (pt)
MARGIN = 28.0
GAP_X, GAP_Y = 14.0, 16.0
FRAME_COLOR = (0.7, 0.7, 0.72)

src = fitz.open(src_path)
out = fitz.open()
cell_w = (A4_W - 2 * MARGIN - (COLS - 1) * GAP_X) / COLS
cell_h = (A4_H - 2 * MARGIN - (ROWS - 1) * GAP_Y) / ROWS

n = src.page_count
for start in range(0, n, per_page):
    page = out.new_page(width=A4_W, height=A4_H)
    for k in range(per_page):
        idx = start + k
        if idx >= n:
            break
        r, c = divmod(k, COLS)            # 横優先（左→右、上→下＝読む順）
        cx = MARGIN + c * (cell_w + GAP_X)
        cy = MARGIN + r * (cell_h + GAP_Y)
        sp = src[idx]
        sw, sh = sp.rect.width, sp.rect.height
        scale = min(cell_w / sw, cell_h / sh)
        w, h = sw * scale, sh * scale
        x0 = cx + (cell_w - w) / 2
        y0 = cy + (cell_h - h) / 2
        target = fitz.Rect(x0, y0, x0 + w, y0 + h)
        page.show_pdf_page(target, src, idx)
        page.draw_rect(target, color=FRAME_COLOR, width=0.5)

out.save(out_path, deflate=True, garbage=4)
print(f"handout出力完了: {n}枚 -> {out.page_count}ページ（{per_page}枚/ページ・{COLS}列x{ROWS}行）-> {out_path}")
