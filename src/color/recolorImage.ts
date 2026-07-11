/**
 * CPU-side full-image recolor: applies `recolorPixel` across every pixel of
 * an RGBA buffer, sampling the (possibly lower-resolution) hair mask with
 * nearest-neighbor lookup.
 *
 * Pure functions, no React imports.
 */

import type { HairMask } from '../segmentation/types';
import { recolorPixel, type RecolorParams } from './recolor';

/** Pixels with a sampled mask confidence below this are copied through untouched. */
const CONFIDENCE_SKIP_THRESHOLD = 0.01;

/** How many low bits to drop per channel when building the memo key (8-bit -> 5-bit). */
const QUANT_SHIFT = 3;

type Memo = Map<string, readonly [number, number, number]>;

/** Nearest-neighbor mask lookup: maps a full-resolution (x,y) to the mask's own grid. */
function sampleMaskNearest(
  mask: HairMask,
  x: number,
  y: number,
  width: number,
  height: number
): number {
  const mx = Math.min(mask.width - 1, Math.floor((x * mask.width) / width));
  const my = Math.min(mask.height - 1, Math.floor((y * mask.height) / height));
  return mask.data[my * mask.width + mx];
}

/**
 * Memo key: quantizes the original color to 5 bits/channel (hair regions
 * have few visually-distinct colors, so most pixels collapse into a small
 * number of buckets) combined with the exact confidence sample (mask
 * resolution is much lower than the photo, and nearest-neighbor sampling
 * means large runs of pixels share the same confidence value, so this still
 * hits well while keeping the memo exact for any confidence variation).
 */
function quantizeKey(r: number, g: number, b: number, confidence: number): string {
  const rq = r >> QUANT_SHIFT;
  const gq = g >> QUANT_SHIFT;
  const bq = b >> QUANT_SHIFT;
  return `${rq},${gq},${bq},${confidence}`;
}

/** Recolors (or passes through) a single RGBA pixel at `idx` into `out`. */
function recolorOnePixelInto(
  rgba: Uint8Array,
  out: Uint8Array,
  idx: number,
  confidence: number,
  params: RecolorParams,
  memo: Memo
): void {
  if (confidence < CONFIDENCE_SKIP_THRESHOLD) {
    out[idx] = rgba[idx];
    out[idx + 1] = rgba[idx + 1];
    out[idx + 2] = rgba[idx + 2];
    out[idx + 3] = rgba[idx + 3];
    return;
  }

  const r = rgba[idx];
  const g = rgba[idx + 1];
  const b = rgba[idx + 2];
  const key = quantizeKey(r, g, b, confidence);

  let outRgb = memo.get(key);
  if (!outRgb) {
    const result = recolorPixel({ r, g, b }, params, confidence);
    outRgb = [result.r, result.g, result.b];
    memo.set(key, outRgb);
  }

  out[idx] = outRgb[0];
  out[idx + 1] = outRgb[1];
  out[idx + 2] = outRgb[2];
  out[idx + 3] = rgba[idx + 3]; // alpha is never touched
}

/**
 * Recolors an RGBA image buffer toward `params.color`, using `mask` as the
 * per-pixel hair-probability confidence (nearest-neighbor sampled if the
 * mask resolution differs from the image). Returns a new buffer; `rgba` is
 * not mutated.
 */
export function recolorImage(
  rgba: Uint8Array,
  width: number,
  height: number,
  mask: HairMask,
  params: RecolorParams
): Uint8Array {
  const out = new Uint8Array(rgba.length);
  const memo: Memo = new Map();

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const confidence = sampleMaskNearest(mask, x, y, width, height);
      recolorOnePixelInto(rgba, out, idx, confidence, params, memo);
    }
  }

  return out;
}

export interface RecolorImageChunkedOptions {
  /** Pixels processed between yields to the event loop. Default 50,000. */
  chunkPixels?: number;
  /** Checked after every chunk; if it returns true, processing stops and resolves to null. */
  isStale?: () => boolean;
}

/**
 * Same algorithm as `recolorImage`, but yields to the JS event loop every
 * `chunkPixels` pixels (via a `setTimeout(0)`) so a large recolor doesn't
 * freeze the UI thread, and supports cooperative cancellation via
 * `isStale` (for example when the user picks a different color mid-run).
 * Resolves to `null` if canceled partway through.
 */
export async function recolorImageChunked(
  rgba: Uint8Array,
  width: number,
  height: number,
  mask: HairMask,
  params: RecolorParams,
  options: RecolorImageChunkedOptions = {}
): Promise<Uint8Array | null> {
  const chunkPixels = options.chunkPixels ?? 50_000;
  const out = new Uint8Array(rgba.length);
  const memo: Memo = new Map();

  let sinceYield = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const confidence = sampleMaskNearest(mask, x, y, width, height);
      recolorOnePixelInto(rgba, out, idx, confidence, params, memo);

      sinceYield += 1;
      if (sinceYield >= chunkPixels) {
        sinceYield = 0;
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        if (options.isStale?.()) {
          return null;
        }
      }
    }
  }

  return out;
}
