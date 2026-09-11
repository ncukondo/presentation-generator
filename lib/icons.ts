/**
 * Material Design Icon helpers for pptxgenjs slides.
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import type { Slide } from "./types";
import { C } from "./theme";

// ── SVG icon loader ──────────────────────────────────────

const MDI_SVG_DIR = resolve(
  import.meta.dir, "../node_modules/@mdi/svg/svg",
);

const cache = new Map<string, string>();

function cacheKey(name: string, color: string): string {
  return `${name}:${color}`;
}

export function iconData(name: string, color: string = C.text): string {
  const key = cacheKey(name, color);
  const hit = cache.get(key);
  if (hit) return hit;

  const svgPath = `${MDI_SVG_DIR}/${name}.svg`;
  let svg = readFileSync(svgPath, "utf-8");
  svg = svg.replace(/<path /g, `<path fill="#${color}" `);

  const data = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
  cache.set(key, data);
  return data;
}

export function addIcon(
  slide: Slide,
  name: string,
  x: number,
  y: number,
  size: number,
  color: string = C.text,
  /** PptxGenJS shape name (e.g. `morphName(key, "icon")` for morph pairing). */
  objectName?: string,
) {
  slide.addImage({
    data: iconData(name, color),
    x, y, w: size, h: size,
    ...(objectName ? { objectName } : {}),
  });
}

// ── Semantic icon names ──────────────────────────────────
export const ICONS = {
  // General
  check: "check-circle-outline",
  alert: "alert-circle-outline",
  info: "information-outline",
  lightbulb: "lightbulb-outline",
  star: "star",

  // Process
  arrowRight: "arrow-right-bold",
  arrowDown: "arrow-down-bold",
  numeric1Circle: "numeric-1-circle",
  numeric2Circle: "numeric-2-circle",
  numeric3Circle: "numeric-3-circle",
  numeric4Circle: "numeric-4-circle",
  numeric5Circle: "numeric-5-circle",
  numeric6Circle: "numeric-6-circle",
  numeric7Circle: "numeric-7-circle",

  // Education
  school: "school-outline",
  brain: "brain",
  bookOpen: "book-open-variant",
  clipboardText: "clipboard-text-outline",
  accountGroup: "account-group-outline",
  headphones: "headphones",
  video: "video-outline",
  microphone: "microphone-outline",

  // Tech
  robot: "robot-outline",
  cloudUpload: "cloud-upload-outline",
  cog: "cog-outline",
  fileDocument: "file-document-outline",
  magnify: "magnify",
  shieldCheck: "shield-check-outline",

  // Communication
  commentQuestion: "comment-question-outline",
  messageText: "message-text-outline",

  // Time
  clockOutline: "clock-outline",
  rocket: "rocket-launch-outline",
  target: "target",
  handshake: "handshake-outline",
} as const;
