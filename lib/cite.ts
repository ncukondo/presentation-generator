/**
 * Citation helper: resolves pandoc citekeys to APA in-text format at build time.
 *
 * Uses `ref cite <key> --in-text` via Bun.spawnSync.
 * Results are cached for the duration of the build.
 *
 * Usage:
 *   cite("qureshi-2023")        → "(Qureshi et al., 2023)"
 *   cite("flemyng-2025")        → "(Flemyng et al., 2025)"
 */

const cache = new Map<string, string>();
const usedKeys = new Set<string>();

/**
 * Resolve a pandoc citekey to APA in-text citation.
 * @param key - Citation key without the @ prefix (e.g. "qureshi-2023")
 * @returns APA in-text string, or the key as fallback on error
 */
export function cite(key: string | undefined | null): string {
  if (!key || !key.trim()) return "";
  const trimmed = key.trim();
  usedKeys.add(trimmed);
  const cached = cache.get(trimmed);
  if (cached !== undefined) return cached;

  const result = Bun.spawnSync(["ref", "cite", trimmed, "--in-text"], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const text = result.stdout.toString().trim();
  if (result.exitCode !== 0 || !text) {
    console.warn(`[cite] Failed to resolve @${trimmed}: ${result.stderr.toString().trim()}`);
    const fallback = `(@${trimmed})`;
    cache.set(trimmed, fallback);
    return fallback;
  }

  cache.set(trimmed, text);
  return text;
}

/**
 * Resolve a citekey to full APA reference string.
 */
function citeApa(key: string): string {
  const result = Bun.spawnSync(["ref", "cite", key, "--style", "apa"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const text = result.stdout.toString().trim();
  if (result.exitCode !== 0 || !text) return `@${key}`;
  return text;
}

/**
 * Get all citation keys used so far, with full APA references.
 * Sorted alphabetically by APA string (author last name).
 */
export function getUsedCitations(): Array<{ key: string; apa: string }> {
  return [...usedKeys]
    .map(key => ({ key, apa: citeApa(key) }))
    .sort((a, b) => a.apa.localeCompare(b.apa));
}
