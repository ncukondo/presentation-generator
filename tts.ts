/**
 * TTS ナレーション生成 — slides.yaml の narration フィールドから音声ファイルを生成
 *
 * Gemini Native Audio (TTS model) を使用して、各スライドのナレーション原稿を
 * WAV ファイルに変換する。生成された音声は voice_output/ に保存される。
 *
 * Usage:
 *   bun run tts
 *
 * 環境変数:
 *   GEMINI_AUDIO_KEY  — Gemini API キー（.env に設定）
 *   TTS_LIMIT=N       — 先頭 N スライドのみ生成（デバッグ用）
 *   TTS_FORCE=1       — 既存ファイルを上書き
 */
import { readFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { getAllSlides } from "./lib/slides-data";

// --- Configuration ---
const GEMINI_MODEL = "gemini-2.5-flash-preview-tts";
const VOICE_NAME = "Kore"; // Aoede, Charon, Fenrir, Kore, Puck など
const API_BASE = "https://generativelanguage.googleapis.com/v1beta";

// --- Load API key from .env ---
function loadApiKey(): string {
  const envPath = join(import.meta.dir, ".env");
  const envContent = readFileSync(envPath, "utf-8");
  const match = envContent.match(/^GEMINI_AUDIO_KEY=(.+)$/m);
  if (!match) throw new Error("GEMINI_AUDIO_KEY not found in .env");
  return match[1]!.trim();
}

// --- Parse narration from slides.yaml ---
function parseNarration(): { slide: string; text: string }[] {
  return getAllSlides()
    .filter((s) => s.narration)
    .map((s) => ({
      slide: s.title,
      text: (s.narration as string).replace(/\n+/g, " ").trim(),
    }));
}

// --- Call Gemini TTS API ---
async function synthesize(
  apiKey: string,
  text: string
): Promise<Uint8Array> {
  const url = `${API_BASE}/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: `次のテキストを、落ち着いた講義ナレーションとして自然に読み上げてください。\n\n${text}`,
            },
          ],
        },
      ],
      generationConfig: {
        response_modalities: ["AUDIO"],
        speech_config: {
          voice_config: {
            prebuilt_voice_config: {
              voice_name: VOICE_NAME,
            },
          },
        },
      },
    }),
  });

  if (resp.status === 429) {
    const body = await resp.text();
    const retryMatch = body.match(/retry in ([\d.]+)s/i);
    const wait = retryMatch ? Math.ceil(parseFloat(retryMatch[1]!)) + 2 : 35;
    console.log(`  ⏳ Rate limited, waiting ${wait}s...`);
    await new Promise((r) => setTimeout(r, wait * 1000));
    return synthesize(apiKey, text);
  }

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Gemini API error ${resp.status}: ${err}`);
  }

  const data = (await resp.json()) as {
    candidates: Array<{
      content: {
        parts: Array<{
          inlineData?: { mimeType: string; data: string };
        }>;
      };
    }>;
  };

  const part = data.candidates?.[0]?.content?.parts?.[0];
  if (!part?.inlineData?.data) {
    throw new Error("No audio data in response: " + JSON.stringify(data));
  }

  const pcm = Uint8Array.from(atob(part.inlineData.data), (c) => c.charCodeAt(0));

  // Parse sample rate from mimeType (e.g. "audio/L16;codec=pcm;rate=24000")
  const rateMatch = part.inlineData.mimeType.match(/rate=(\d+)/);
  const sampleRate = rateMatch ? parseInt(rateMatch[1]!) : 24000;

  return pcmToWav(pcm, sampleRate);
}

/** Wrap raw PCM (16-bit mono) in a WAV container. */
function pcmToWav(pcm: Uint8Array, sampleRate: number): Uint8Array {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const headerSize = 44;
  const wav = new Uint8Array(headerSize + pcm.length);
  const view = new DataView(wav.buffer);

  // "RIFF" chunk
  wav.set([0x52, 0x49, 0x46, 0x46], 0); // "RIFF"
  view.setUint32(4, 36 + pcm.length, true); // file size - 8
  wav.set([0x57, 0x41, 0x56, 0x45], 8); // "WAVE"

  // "fmt " sub-chunk
  wav.set([0x66, 0x6d, 0x74, 0x20], 12); // "fmt "
  view.setUint32(16, 16, true); // sub-chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // "data" sub-chunk
  wav.set([0x64, 0x61, 0x74, 0x61], 36); // "data"
  view.setUint32(40, pcm.length, true);
  wav.set(pcm, headerSize);

  return wav;
}

// --- Main ---
async function main() {
  const apiKey = loadApiKey();
  console.log("API key loaded.");

  const narrations = parseNarration();
  console.log(`Found ${narrations.length} slides with narration`);

  const outputDir = join(import.meta.dir, "voice_output");
  mkdirSync(outputDir, { recursive: true });

  const limit = parseInt(process.env.TTS_LIMIT || "0") || narrations.length;
  const skipExisting = process.env.TTS_FORCE !== "1";
  for (let i = 0; i < Math.min(narrations.length, limit); i++) {
    const { slide, text } = narrations[i]!;
    const slideNum = String(i + 1).padStart(2, "0");
    const outPath = join(outputDir, `slide${slideNum}.wav`);

    if (skipExisting && existsSync(outPath)) {
      console.log(`[Slide ${slideNum}] ${slide} — skipped (exists)`);
      continue;
    }

    console.log(`[Slide ${slideNum}] ${slide} (${text.length} chars)`);

    const audio = await synthesize(apiKey, text);
    await Bun.write(outPath, audio);
    console.log(`  → ${outPath} (${audio.length} bytes)`);
  }

  console.log("Done!");
}

main().catch(console.error);
