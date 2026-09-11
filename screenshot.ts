/**
 * Screenshot generator: converts PPTX slides to PNG images.
 *
 * Auto-detects the environment and uses the appropriate backend:
 *   - WSL + PowerPoint: PowerShell COM automation
 *   - LibreOffice: soffice --headless → PDF → pdftoppm
 *
 * Usage:
 *   bun run screenshot
 *
 * Output: output_images/slide_001.png, slide_002.png, ...
 */
import { existsSync, mkdirSync, readdirSync, renameSync, unlinkSync } from "fs";
import { join, resolve } from "path";

const BASE_DIR = import.meta.dir;
const PPTX_FILE = join(BASE_DIR, "presentation.pptx");
const OUTPUT_DIR = join(BASE_DIR, "output_images");
const WIDTH = 960;
const HEIGHT = 540;

async function run(cmd: string[]): Promise<string> {
  const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  const code = await proc.exited;
  if (code !== 0) {
    throw new Error(`Command failed (${code}): ${cmd.join(" ")}\n${stderr}`);
  }
  return stdout.trim();
}

async function commandExists(cmd: string): Promise<boolean> {
  try {
    await run(["which", cmd]);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Backend: WSL + PowerPoint
// ---------------------------------------------------------------------------
async function screenshotWithPowerPoint() {
  console.log("Backend: PowerPoint (WSL)");

  const pptxWin = (await run(["wslpath", "-w", resolve(PPTX_FILE)])).trim();
  const outputWin = (await run(["wslpath", "-w", resolve(OUTPUT_DIR)])).trim();

  const psScript = `
$ErrorActionPreference = "Stop"
$ppt = $null; $presentation = $null
try {
  $ppt = New-Object -ComObject PowerPoint.Application
  $presentation = $ppt.Presentations.Open("${pptxWin}", -1, 0, 0)
  $total = $presentation.Slides.Count
  Write-Host "Total slides: $total"
  for ($i = 1; $i -le $total; $i++) {
    $slide = $presentation.Slides.Item($i)
    $out = Join-Path "${outputWin}" ("slide_{0:D3}.png" -f $i)
    $slide.Export($out, "PNG", ${WIDTH}, ${HEIGHT})
    Write-Host ("Exported: slide_{0:D3}.png" -f $i)
  }
} finally {
  if ($presentation) { $presentation.Close(); [System.Runtime.Interopservices.Marshal]::ReleaseComObject($presentation) | Out-Null }
  if ($ppt) { $ppt.Quit(); [System.Runtime.Interopservices.Marshal]::ReleaseComObject($ppt) | Out-Null }
  [System.GC]::Collect(); [System.GC]::WaitForPendingFinalizers()
}`;

  await run(["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", psScript]);
}

// ---------------------------------------------------------------------------
// Backend: LibreOffice + pdftoppm
// ---------------------------------------------------------------------------
async function screenshotWithLibreOffice() {
  const soffice = (await commandExists("soffice")) ? "soffice" : "libreoffice";
  console.log(`Backend: LibreOffice (${soffice}) + pdftoppm`);

  // Step 1: PPTX → PDF
  const tempDir = join(BASE_DIR, "screenshot_temp");
  mkdirSync(tempDir, { recursive: true });

  await run([
    soffice, "--headless", "--convert-to", "pdf",
    "--outdir", tempDir,
    PPTX_FILE,
  ]);

  const pdfPath = join(tempDir, "presentation.pdf");
  if (!existsSync(pdfPath)) {
    throw new Error("LibreOffice PDF conversion failed — output not found");
  }

  // Step 2: PDF → PNG (pdftoppm)
  const prefix = join(tempDir, "slide");
  await run([
    "pdftoppm", "-png",
    "-scale-to-x", String(WIDTH),
    "-scale-to-y", String(HEIGHT),
    pdfPath, prefix,
  ]);

  // Step 3: Rename pdftoppm output (slide-01.png → slide_001.png)
  const files = readdirSync(tempDir)
    .filter((f) => f.startsWith("slide-") && f.endsWith(".png"))
    .sort();

  for (const file of files) {
    // pdftoppm outputs: slide-1.png or slide-01.png depending on page count
    const match = file.match(/^slide-(\d+)\.png$/);
    if (match) {
      const num = String(parseInt(match[1]!)).padStart(3, "0");
      const dest = join(OUTPUT_DIR, `slide_${num}.png`);
      renameSync(join(tempDir, file), dest);
      console.log(`Exported: slide_${num}.png`);
    }
  }

  // Cleanup
  unlinkSync(pdfPath);
  try {
    const remaining = readdirSync(tempDir);
    for (const f of remaining) unlinkSync(join(tempDir, f));
    readdirSync(tempDir).length === 0 && Bun.spawnSync(["rmdir", tempDir]);
  } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  if (!existsSync(PPTX_FILE)) {
    throw new Error(`PPTX not found: ${PPTX_FILE}\nRun 'bun run generate' first.`);
  }

  mkdirSync(OUTPUT_DIR, { recursive: true });
  // 前回ビルドの残骸（スライド数が減った時の古い slide_NNN.png）を消してから書き出す
  for (const f of readdirSync(OUTPUT_DIR)) {
    if (/^slide_\d+\.png$/.test(f)) unlinkSync(join(OUTPUT_DIR, f));
  }

  // Detect backend
  const hasWSL = await commandExists("wslpath");
  const hasPowerPoint = hasWSL && await commandExists("powershell.exe");
  const hasLibreOffice = (await commandExists("soffice")) || (await commandExists("libreoffice"));
  const hasPdftoppm = await commandExists("pdftoppm");

  if (hasPowerPoint) {
    await screenshotWithPowerPoint();
  } else if (hasLibreOffice && hasPdftoppm) {
    await screenshotWithLibreOffice();
  } else {
    const missing: string[] = [];
    if (!hasLibreOffice) missing.push("libreoffice (apt install libreoffice)");
    if (!hasPdftoppm) missing.push("pdftoppm (apt install poppler-utils)");
    throw new Error(
      `No screenshot backend available.\n` +
      `Install one of:\n` +
      `  - PowerPoint (WSL environment)\n` +
      `  - LibreOffice + pdftoppm:\n` +
      missing.map((m) => `      ${m}`).join("\n")
    );
  }

  const count = readdirSync(OUTPUT_DIR).filter((f) => f.match(/^slide_\d+\.png$/)).length;
  console.log(`\nDone: ${count} slides → ${OUTPUT_DIR}`);
}

main().catch((e) => {
  console.error("Error:", e.message || e);
  process.exit(1);
});
