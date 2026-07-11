/**
 * Luminance-preserving recolor reference implementation.
 *
 * Given an original pixel, a target HairColor, a user intensity, and a
 * per-pixel hair-probability confidence (0..1, from segmentation -
 * mocked/absent this iteration), computes the recolored pixel.
 *
 * Pure functions, no React imports.
 */

import type { HairColor } from '../catalog/types';
import { srgbToLab, labToSrgb, type Rgb } from './lab';

export interface RecolorParams {
  color: HairColor;
  intensity: number; // 0..1 user slider, default 1
}

/** Linear interpolation: returns a when t=0, b when t=1. */
export function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * The maximum number of L units a dye is allowed to *lighten* the original
 * pixel by. Darkening is unrestricted. More opaque dyes get more lift
 * (since they're better at truly overriding the underlying pigment);
 * less opaque ("toner"-like) dyes get less.
 */
export function computeMaxLift(opacity: number): number {
  return 12 + 10 * (1 - opacity);
}

function clampByte(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value)));
}

/**
 * Recolors a single sRGB pixel toward `params.color`, blended by the dye's
 * own opacity, the segmentation confidence that this pixel is hair, and the
 * user's intensity slider.
 */
export function recolorPixel(
  original: Rgb,
  params: RecolorParams,
  confidence: number
): Rgb {
  const { color, intensity } = params;
  const origLab = srgbToLab(original);

  // Chroma: blend a/b fully toward the target shade's a/b.
  const recoloredA = color.targetLab.a;
  const recoloredB = color.targetLab.b;

  // Luminance with lift limiting: darkening is free, lightening is capped.
  const maxLift = computeMaxLift(color.opacity);
  const isLightening = color.targetLab.l > origLab.l;
  const targetL = isLightening
    ? Math.min(color.targetLab.l, origLab.l + maxLift)
    : color.targetLab.l;

  // Highlight retention: keep some of the original luminance structure.
  const outL = mix(targetL, origLab.l, color.highlightRetention * 0.5);

  const recoloredRgb = labToSrgb({ l: outL, a: recoloredA, b: recoloredB });

  const blendAmount = color.opacity * confidence * intensity;

  return {
    r: clampByte(mix(original.r, recoloredRgb.r, blendAmount)),
    g: clampByte(mix(original.g, recoloredRgb.g, blendAmount)),
    b: clampByte(mix(original.b, recoloredRgb.b, blendAmount)),
  };
}
