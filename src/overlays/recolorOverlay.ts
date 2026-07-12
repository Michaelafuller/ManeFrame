/**
 * Recolors a rasterized overlay image (RGBA pixels from a rendered SVG
 * hairstyle asset) using the exact same Lab recolor pipeline the hair
 * segmentation path uses (`recolorImageChunked`/`recolorPixel`), per
 * docs/HANDOFF.md: "treat overlay alpha as the confidence input to
 * recolorPixel." The overlay's own alpha channel stands in for a
 * `HairMask`'s per-pixel hair probability — fully transparent pixels
 * (background) are left untouched, fully opaque pixels (solid hair fill)
 * are recolored at full strength, and the soft edges the art already has
 * (via its gradient/opacity falloff) blend proportionally, exactly like a
 * real segmentation mask's soft edges do.
 *
 * Pure functions, no React/Skia import — the actual SVG rasterization
 * (Skia-dependent, not unit-testable in Jest) lives in `rasterize.ts`;
 * this module only operates on already-decoded RGBA buffers.
 */

import type { HairMask } from '../segmentation/types';
import { recolorImageChunked, type RecolorImageChunkedOptions } from '../color/recolorImage';
import type { RecolorParams } from '../color/recolor';

/**
 * Builds a synthetic `HairMask` from an RGBA buffer's own alpha channel
 * (normalized 0..1). `width`/`height` must match the buffer's own pixel
 * dimensions (this mask is always sampled 1:1, never resized).
 */
export function overlayAlphaMask(pixels: Uint8Array, width: number, height: number): HairMask {
  const pixelCount = width * height;
  const data = new Float32Array(pixelCount);
  for (let i = 0; i < pixelCount; i++) {
    data[i] = pixels[i * 4 + 3] / 255;
  }
  return { width, height, data };
}

/**
 * Recolors a rasterized overlay's RGBA pixels toward `params.color`,
 * confidence-gated by the overlay's own alpha (see module doc). The
 * output's alpha channel is untouched (`recolorImageChunked` never
 * touches alpha), so the recolored raster composites identically to the
 * original — only the RGB hue/luminance shifts.
 */
export async function recolorOverlayImage(
  pixels: Uint8Array,
  width: number,
  height: number,
  params: RecolorParams,
  options: RecolorImageChunkedOptions = {}
): Promise<Uint8Array | null> {
  const mask = overlayAlphaMask(pixels, width, height);
  return recolorImageChunked(pixels, width, height, mask, params, options);
}
