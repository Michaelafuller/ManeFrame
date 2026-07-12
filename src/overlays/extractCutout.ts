/**
 * Donor-hair cutout extraction (Iteration 5R / M6 remediation).
 *
 * Turns a donor portrait + its segmentation masks (hair + face-skin, from
 * the app's own `segmentBoth` pipeline) into a soft-alpha RGBA hair cutout
 * ready to ship as an overlay asset:
 *
 *   1. Feather the hair mask's edges (small box blur) so the cutout's rim
 *      blends instead of stair-stepping.
 *   2. Build a donor-resolution alpha channel by bilinearly sampling the
 *      feathered mask (masks are model-resolution, e.g. 256x256, while the
 *      donor photo is larger).
 *   3. Crop to the hair's bounding box, UNIONed with the donor's detected
 *      face box so the face-box anchor recorded for placement always lies
 *      inside the cutout canvas (the catalog's `assets.headBox` validation
 *      requires normalized 0..1 coords; transparent padding rows compress
 *      to almost nothing in PNG).
 *   4. Record the donor face box in cutout-relative normalized coords -
 *      the placement anchor (`scale = target face width / donor face
 *      width`, top-centers aligned; see `computeUniformOverlayTransform`).
 *
 * Pure functions, no React/Skia imports - fully unit-testable in Jest.
 * The on-device harness that feeds real donor pixels through this module
 * is a one-time dev tool (see docs/ART.md); this module is committed so
 * the extraction is reviewable and reproducible.
 */

import type { HairMask } from '../segmentation/types';
import type { NormalizedBox } from '../placement/types';
import { computeMaskBoundingBox } from '../placement/headBox';

export interface CutoutOptions {
  /**
   * Box-blur radius (in mask pixels) applied to the hair mask before
   * sampling, to feather the cutout edge. 0 disables feathering.
   */
  featherRadius?: number;
  /**
   * Alpha values below this (0..1, after feathering) are clamped to fully
   * transparent - kills faint far-from-hair mask noise that would
   * otherwise ghost-tint the background of the cutout.
   */
  alphaFloor?: number;
  /** Threshold (0..1) used to compute the hair bounding box for cropping. */
  cropThreshold?: number;
  /**
   * Extra transparent margin around the crop box, as a fraction of the
   * crop box's larger side - keeps feathered edges from being clipped.
   */
  marginFraction?: number;
  /** Threshold used to locate the donor's face box in the face mask. */
  faceThreshold?: number;
}

export interface CutoutResult {
  /** RGBA_8888, unpremultiplied: donor RGB, alpha = feathered hair mask. */
  pixels: Uint8Array;
  width: number;
  height: number;
  /** Donor face box in cutout-relative normalized (0..1) coordinates. */
  faceBox: NormalizedBox;
  /**
   * Fraction (0..1) of pixels inside `faceBox` whose cutout alpha exceeds
   * 0.1 - an early read on the face-occlusion gate ("hair must not sit on
   * the face": the shipped-asset unit test asserts < 0.2).
   */
  hairCoverageInFaceBox: number;
}

const DEFAULT_OPTIONS: Required<CutoutOptions> = {
  featherRadius: 2,
  alphaFloor: 0.06,
  cropThreshold: 0.2,
  marginFraction: 0.02,
  faceThreshold: 0.5,
};

/**
 * Separable box blur on a mask, radius in whole pixels. Edge pixels use a
 * shrunken window (no wrap, no zero-padding bias). Radius 0 returns a
 * copy. Two passes (horizontal then vertical) of a box kernel - smooth
 * enough for edge feathering without pulling in a real Gaussian.
 */
export function blurMask(mask: HairMask, radius: number): HairMask {
  const { width, height, data } = mask;
  if (radius <= 0) {
    return { width, height, data: new Float32Array(data) };
  }
  const r = Math.floor(radius);
  const horizontal = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const lo = Math.max(0, x - r);
      const hi = Math.min(width - 1, x + r);
      let sum = 0;
      for (let i = lo; i <= hi; i++) sum += data[row + i];
      horizontal[row + x] = sum / (hi - lo + 1);
    }
  }
  const out = new Float32Array(width * height);
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const lo = Math.max(0, y - r);
      const hi = Math.min(height - 1, y + r);
      let sum = 0;
      for (let i = lo; i <= hi; i++) sum += horizontal[i * width + x];
      out[y * width + x] = sum / (hi - lo + 1);
    }
  }
  return { width, height, data: out };
}

/**
 * Bilinear sample of a mask at normalized (u, v) in [0,1], treating mask
 * cells as pixel centers (same convention as the tensor pipeline's
 * bilinear resize). Out-of-range coordinates clamp to the border.
 */
export function sampleMaskBilinear(mask: HairMask, u: number, v: number): number {
  const { width, height, data } = mask;
  const fx = Math.min(Math.max(u * width - 0.5, 0), width - 1);
  const fy = Math.min(Math.max(v * height - 0.5, 0), height - 1);
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(x0 + 1, width - 1);
  const y1 = Math.min(y0 + 1, height - 1);
  const tx = fx - x0;
  const ty = fy - y0;
  const top = data[y0 * width + x0] * (1 - tx) + data[y0 * width + x1] * tx;
  const bottom = data[y1 * width + x0] * (1 - tx) + data[y1 * width + x1] * tx;
  return top * (1 - ty) + bottom * ty;
}

/**
 * Extracts the hair cutout from a donor portrait. Returns `null` when the
 * masks contain no hair or no face above the thresholds (an unusable
 * donor - callers should report the gap, not fabricate a cutout).
 */
export function computeCutout(
  donorPixels: Uint8Array,
  donorWidth: number,
  donorHeight: number,
  hairMask: HairMask,
  faceMask: HairMask,
  options: CutoutOptions = {}
): CutoutResult | null {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  if (donorPixels.length < donorWidth * donorHeight * 4) return null;

  const faceBoxDonor = computeMaskBoundingBox(faceMask, opts.faceThreshold);
  if (!faceBoxDonor) return null;

  const feathered = blurMask(hairMask, opts.featherRadius);

  // Donor-resolution alpha channel.
  const alpha = new Float32Array(donorWidth * donorHeight);
  let anyHair = false;
  for (let y = 0; y < donorHeight; y++) {
    const v = (y + 0.5) / donorHeight;
    for (let x = 0; x < donorWidth; x++) {
      const a = sampleMaskBilinear(feathered, (x + 0.5) / donorWidth, v);
      const clamped = a < opts.alphaFloor ? 0 : Math.min(1, a);
      alpha[y * donorWidth + x] = clamped;
      if (clamped > opts.cropThreshold) anyHair = true;
    }
  }
  if (!anyHair) return null;

  // Hair bounding box at donor resolution.
  let minX = donorWidth;
  let minY = donorHeight;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < donorHeight; y++) {
    for (let x = 0; x < donorWidth; x++) {
      if (alpha[y * donorWidth + x] > opts.cropThreshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  // Union with the donor face box (in donor pixels) so the recorded
  // anchor always lies inside the cutout canvas.
  const facePx = {
    x0: Math.floor(faceBoxDonor.x * donorWidth),
    y0: Math.floor(faceBoxDonor.y * donorHeight),
    x1: Math.ceil((faceBoxDonor.x + faceBoxDonor.w) * donorWidth) - 1,
    y1: Math.ceil((faceBoxDonor.y + faceBoxDonor.h) * donorHeight) - 1,
  };
  minX = Math.min(minX, facePx.x0);
  minY = Math.min(minY, facePx.y0);
  maxX = Math.max(maxX, facePx.x1);
  maxY = Math.max(maxY, facePx.y1);

  const margin = Math.round(Math.max(maxX - minX + 1, maxY - minY + 1) * opts.marginFraction);
  minX = Math.max(0, minX - margin);
  minY = Math.max(0, minY - margin);
  maxX = Math.min(donorWidth - 1, maxX + margin);
  maxY = Math.min(donorHeight - 1, maxY + margin);

  const cutW = maxX - minX + 1;
  const cutH = maxY - minY + 1;
  const out = new Uint8Array(cutW * cutH * 4);
  for (let y = 0; y < cutH; y++) {
    const srcY = minY + y;
    for (let x = 0; x < cutW; x++) {
      const srcX = minX + x;
      const srcIdx = (srcY * donorWidth + srcX) * 4;
      const dstIdx = (y * cutW + x) * 4;
      const a = alpha[srcY * donorWidth + srcX];
      out[dstIdx] = donorPixels[srcIdx];
      out[dstIdx + 1] = donorPixels[srcIdx + 1];
      out[dstIdx + 2] = donorPixels[srcIdx + 2];
      out[dstIdx + 3] = Math.round(a * 255);
    }
  }

  // Donor face box, re-expressed relative to the cutout canvas.
  const faceBox: NormalizedBox = {
    x: (faceBoxDonor.x * donorWidth - minX) / cutW,
    y: (faceBoxDonor.y * donorHeight - minY) / cutH,
    w: (faceBoxDonor.w * donorWidth) / cutW,
    h: (faceBoxDonor.h * donorHeight) / cutH,
  };

  // Early face-occlusion read: fraction of face-box pixels with alpha > 0.1.
  let faceArea = 0;
  let faceCovered = 0;
  const fx0 = Math.max(0, Math.floor(faceBox.x * cutW));
  const fy0 = Math.max(0, Math.floor(faceBox.y * cutH));
  const fx1 = Math.min(cutW - 1, Math.ceil((faceBox.x + faceBox.w) * cutW) - 1);
  const fy1 = Math.min(cutH - 1, Math.ceil((faceBox.y + faceBox.h) * cutH) - 1);
  for (let y = fy0; y <= fy1; y++) {
    for (let x = fx0; x <= fx1; x++) {
      faceArea++;
      if (out[(y * cutW + x) * 4 + 3] > 25) faceCovered++;
    }
  }

  return {
    pixels: out,
    width: cutW,
    height: cutH,
    faceBox,
    hairCoverageInFaceBox: faceArea > 0 ? faceCovered / faceArea : 0,
  };
}
