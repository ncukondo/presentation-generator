/**
 * Minimal color utilities (no dependencies).
 *
 * All colors are 6-digit hex strings WITHOUT a leading "#", matching the
 * convention used by `lib/theme.ts` and PptxGenJS (e.g. "1E88E5").
 *
 * Used by lib/themes.ts to derive a full palette from a small set of seed
 * colors and to keep generated step/pastel colors within WCAG contrast bounds.
 */

export type Hex = string;

// ── hex ⇄ rgb ────────────────────────────────────────────
interface Rgb { r: number; g: number; b: number; } // 0–255
interface Hsl { h: number; s: number; l: number; }  // h:0–360, s/l:0–1

export function normalizeHex(hex: string): Hex {
  let h = hex.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(h)) {
    h = h.split("").map((c) => c + c).join("");
  }
  return h.toUpperCase();
}

export function isHex(hex: unknown): hex is Hex {
  return typeof hex === "string" && /^#?[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(hex.trim());
}

function hexToRgb(hex: string): Rgb {
  const h = normalizeHex(hex);
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }: Rgb): Hex {
  const c = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, "0");
  return (c(r) + c(g) + c(b)).toUpperCase();
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

// ── rgb ⇄ hsl ────────────────────────────────────────────
function rgbToHsl({ r, g, b }: Rgb): Hsl {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r: h = ((g - b) / d) % 6; break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4; break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s, l };
}

function hslToRgb({ h, s, l }: Hsl): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

export function hexToHsl(hex: string): Hsl {
  return rgbToHsl(hexToRgb(hex));
}

export function hslToHex(hsl: Hsl): Hex {
  return rgbToHex(hslToRgb({
    h: ((hsl.h % 360) + 360) % 360,
    s: clamp(hsl.s, 0, 1),
    l: clamp(hsl.l, 0, 1),
  }));
}

// ── transforms ───────────────────────────────────────────
/** Lighten toward L=1 by `amount` (0–1). */
export function lighten(hex: string, amount: number): Hex {
  const hsl = hexToHsl(hex);
  hsl.l = clamp(hsl.l + (1 - hsl.l) * amount, 0, 1);
  return hslToHex(hsl);
}

/** Darken toward L=0 by `amount` (0–1). */
export function darken(hex: string, amount: number): Hex {
  const hsl = hexToHsl(hex);
  hsl.l = clamp(hsl.l * (1 - amount), 0, 1);
  return hslToHex(hsl);
}

/** Mix `hex` with white by `ratio` (0 = original, 1 = white). Good for pastels. */
export function mixWhite(hex: string, ratio: number): Hex {
  const { r, g, b } = hexToRgb(hex);
  const t = clamp(ratio, 0, 1);
  return rgbToHex({
    r: r + (255 - r) * t,
    g: g + (255 - g) * t,
    b: b + (255 - b) * t,
  });
}

/** Rotate hue by `deg` degrees, preserving S and L. */
export function rotateHue(hex: string, deg: number): Hex {
  const hsl = hexToHsl(hex);
  hsl.h += deg;
  return hslToHex(hsl);
}

// ── contrast (WCAG) ──────────────────────────────────────
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const lin = (c: number) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a), lb = relativeLuminance(b);
  const hi = Math.max(la, lb), lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Darken `hex` (lowering L) until it reaches at least `minRatio` contrast
 * against white. Used so generated step/category colors stay legible as
 * large text / fills on the warm background (≈ white). Returns the original
 * if it already passes or if pure black still cannot reach the target.
 */
export function ensureContrastOnWhite(hex: string, minRatio = 3.0): Hex {
  const hsl = hexToHsl(hex);
  let l = hsl.l;
  for (let i = 0; i < 40; i++) {
    const candidate = hslToHex({ ...hsl, l });
    if (contrastRatio(candidate, "FFFFFF") >= minRatio) return candidate;
    l -= 0.025;
    if (l <= 0) break;
  }
  return hslToHex({ ...hsl, l: 0 });
}
