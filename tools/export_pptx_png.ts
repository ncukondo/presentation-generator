/**
 * 任意の .pptx を 1 スライド 1 PNG に書き出す（WSL + PowerPoint COM）。
 * 昨年度スライドを「素材(スライド画像)」として保存する用途。
 *
 * Usage:
 *   bun run tools/export_pptx_png.ts <input.pptx> <output_dir>
 *   bun run tools/export_pptx_png.ts "../2025年度/2025年版_医学教育と研究.pptx" materials/2025/png
 */
import { existsSync, mkdirSync } from "fs";
import { resolve } from "path";

const WIDTH = 1280;
const HEIGHT = 720;

async function run(cmd: string[]): Promise<string> {
  const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "pipe" });
  const [out, err] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  if ((await proc.exited) !== 0) throw new Error(`${cmd.join(" ")}\n${err}`);
  return out.trim();
}

const [, , input, outDir] = process.argv;
if (!input || !outDir) {
  console.error("Usage: bun run tools/export_pptx_png.ts <input.pptx> <output_dir>");
  process.exit(1);
}
const inAbs = resolve(input);
const outAbs = resolve(outDir);
if (!existsSync(inAbs)) throw new Error(`not found: ${inAbs}`);
mkdirSync(outAbs, { recursive: true });

const inWin = await run(["wslpath", "-w", inAbs]);
const outWin = await run(["wslpath", "-w", outAbs]);

const ps = `
$ErrorActionPreference = "Stop"
$ppt = $null; $p = $null
try {
  $ppt = New-Object -ComObject PowerPoint.Application
  $p = $ppt.Presentations.Open("${inWin}", -1, 0, 0)
  $n = $p.Slides.Count
  Write-Host "Total slides: $n"
  for ($i = 1; $i -le $n; $i++) {
    $out = Join-Path "${outWin}" ("slide_{0:D3}.png" -f $i)
    $p.Slides.Item($i).Export($out, "PNG", ${WIDTH}, ${HEIGHT})
  }
  Write-Host "Exported $n slides"
} finally {
  if ($p) { $p.Close() }
  if ($ppt) { $ppt.Quit() }
  [System.GC]::Collect(); [System.GC]::WaitForPendingFinalizers()
}`;

console.log(await run(["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", ps]));
console.log(`Done -> ${outAbs}`);
