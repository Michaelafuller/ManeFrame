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
   * 0.1 - the WHOLE-FACE BACKSTOP gate (Iteration 5R round 2: must stay
   * < `WHOLE_FACE_MAX_COVERAGE`). Pixel-identical whether measured here
   * (cutout-space) or against the original donor photo, since cropping
   * never resamples pixels - only the plausibility checks below need true
   * donor-image dimensions.
   */
  hairCoverageInFaceBox: number;
  /**
   * Fraction (0..1) of pixels inside the INNER face box (eyes/nose/mouth
   * zone - see `computeInnerFaceBox`) whose cutout alpha exceeds 0.1 - the
   * HARD gate (Iteration 5R round 2: must stay < `INNER_FACE_MAX_COVERAGE`).
   * Face-framing strands over cheeks/temples (outside this inner zone) are
   * legal; this is what "hair sitting on the eyes/nose/mouth" actually
   * measures.
   */
  innerFaceCoverage: number;
  /** The donor's detected face box BEFORE cropping, in the ORIGINAL donor photo's normalized (0..1) coordinates - needed for the plausibility check below, which is scale-dependent on the true image dimensions (cropping tightens the frame around the face, so the cutout-space faceBox's own normalized size is not representative of the original detection). */
  donorFaceBox: NormalizedBox;
  donorWidth: number;
  donorHeight: number;
  /** Face-box plausibility verdict (Iteration 5R round 2) - see `checkFaceBoxPlausibility`. */
  faceBoxPlausibility: FaceBoxPlausibility;
  /** Combined revised-gate verdict: plausibility AND inner-face AND whole-face all pass. */
  gatePass: boolean;
  /** Human-readable reasons the gate failed; empty when `gatePass` is true. */
  gateReasons: string[];
}

const DEFAULT_OPTIONS: Required<CutoutOptions> = {
  featherRadius: 2,
  alphaFloor: 0.06,
  cropThreshold: 0.2,
  marginFraction: 0.02,
  faceThreshold: 0.5,
};

/**
 * Occlusion-gate thresholds (Iteration 5R round 2 planner revision -
 * replaces the flat <20% whole-face rule from round 1). See
 * `docs/HANDOFF.md`'s "ROUND 2 ADDENDUM" for the rationale: face-framing
 * strands over cheeks/temples are legal (that's what real long styles do),
 * but hair must not sit over the eyes/nose/mouth, and a flat backstop still
 * catches wholesale face occlusion.
 */
export const INNER_FACE_MAX_COVERAGE = 0.15;
export const WHOLE_FACE_MAX_COVERAGE = 0.5;

/** Inner face box fractional bounds (of the outer face box), per the round-2 addendum. */
const INNER_X0_FRACTION = 0.2;
const INNER_X1_FRACTION = 0.8;
const INNER_Y0_FRACTION = 0.15;
const INNER_Y1_FRACTION = 0.85;

/** Face-box plausibility bounds, per the round-2 addendum. */
const FACE_BOX_ASPECT_MIN = 0.55;
const FACE_BOX_ASPECT_MAX = 1.15;
const FACE_BOX_WIDTH_FRACTION_MIN = 0.15;
const FACE_BOX_WIDTH_FRACTION_MAX = 0.6;
/** "top edge in the bottom third of the image" - y > 2/3. */
const FACE_BOX_TOP_THIRD_LIMIT = 2 / 3;

/** Matches the shipped-asset test's threshold: alpha > 0.1 (25/255) counts as "covered". */
const ALPHA_COVERED_THRESHOLD = 25;

export interface FaceBoxPlausibility {
  plausible: boolean;
  reasons: string[];
}

/**
 * The INNER face box: x in [faceBox.x + 0.20w, faceBox.x + 0.80w], y in
 * [faceBox.y + 0.15h, faceBox.y + 0.85h] - the eyes/nose/mouth zone.
 * Expressed in the same coordinate space as `faceBox` (cutout-normalized
 * for a `CutoutResult.faceBox`, donor-normalized for a `donorFaceBox`).
 */
export function computeInnerFaceBox(faceBox: NormalizedBox): NormalizedBox {
  return {
    x: faceBox.x + INNER_X0_FRACTION * faceBox.w,
    y: faceBox.y + INNER_Y0_FRACTION * faceBox.h,
    w: (INNER_X1_FRACTION - INNER_X0_FRACTION) * faceBox.w,
    h: (INNER_Y1_FRACTION - INNER_Y0_FRACTION) * faceBox.h,
  };
}

/**
 * Fraction (0..1) of pixels inside `box` (normalized, in `pixels`' own
 * coordinate space) whose alpha channel exceeds `alphaThreshold`. Shared by
 * the extraction harness (reading freshly-computed cutout pixels) and the
 * shipped-asset pngjs test (reading a decoded PNG's pixel buffer) - same
 * function, same threshold, independently re-derivable from either source.
 */
export function computeAlphaCoverage(
  pixels: Uint8Array,
  width: number,
  height: number,
  box: NormalizedBox,
  alphaThreshold: number = ALPHA_COVERED_THRESHOLD
): number {
  const x0 = Math.max(0, Math.floor(box.x * width));
  const y0 = Math.max(0, Math.floor(box.y * height));
  const x1 = Math.min(width - 1, Math.ceil((box.x + box.w) * width) - 1);
  const y1 = Math.min(height - 1, Math.ceil((box.y + box.h) * height) - 1);

  let area = 0;
  let covered = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      area++;
      if (pixels[(y * width + x) * 4 + 3] > alphaThreshold) covered++;
    }
  }
  return area > 0 ? covered / area : 0;
}

/**
 * Face-box plausibility check (Iteration 5R round 2 - fixes the
 * "shoulder-lock false pass": `classic-lob`'s "Model Features" candidate
 * locked the face-skin mask onto a bare shoulder, which numerically scored
 * 0% occlusion despite being anchored to the wrong region entirely). Must
 * be evaluated against the TRUE original-image dimensions the face box was
 * detected in - `imageWidth`/`imageHeight` should be the donor photo's own
 * pixel dimensions, not a cropped cutout's (cropping tightens the frame
 * around the face, which would make an otherwise-plausible box fail the
 * width-fraction/vertical-position checks purely as an artifact of the
 * crop, not the detection).
 */
export function checkFaceBoxPlausibility(
  faceBox: NormalizedBox,
  imageWidth: number,
  imageHeight: number
): FaceBoxPlausibility {
  const reasons: string[] = [];
  const widthPx = faceBox.w * imageWidth;
  const heightPx = faceBox.h * imageHeight;
  const aspect = heightPx > 0 ? widthPx / heightPx : 0;

  if (aspect < FACE_BOX_ASPECT_MIN || aspect > FACE_BOX_ASPECT_MAX) {
    reasons.push(
      `face-box aspect w/h ${aspect.toFixed(3)} outside [${FACE_BOX_ASPECT_MIN}, ${FACE_BOX_ASPECT_MAX}]`
    );
  }
  if (faceBox.w < FACE_BOX_WIDTH_FRACTION_MIN || faceBox.w > FACE_BOX_WIDTH_FRACTION_MAX) {
    reasons.push(
      `face-box width fraction ${faceBox.w.toFixed(3)} outside [${FACE_BOX_WIDTH_FRACTION_MIN}, ${FACE_BOX_WIDTH_FRACTION_MAX}]`
    );
  }
  if (faceBox.y > FACE_BOX_TOP_THIRD_LIMIT) {
    reasons.push(
      `face-box top edge y=${faceBox.y.toFixed(3)} in the bottom third of the image (> ${FACE_BOX_TOP_THIRD_LIMIT.toFixed(3)})`
    );
  }
  return { plausible: reasons.length === 0, reasons };
}

/**
 * Zeroes every mask cell that is not part of the largest 4-connected
 * region above `threshold`. Kills stray low-confidence islands (eyebrow
 * wisps, background noise, clothing misreads) that would otherwise ship
 * as faint floating blobs in the cutout. Same flood-fill approach as
 * `computeMaskBoundingBox`, but returning the filtered mask instead of a
 * box. Returns an all-zero mask when nothing exceeds the threshold.
 */
export function keepLargestRegion(mask: HairMask, threshold: number): HairMask {
  const { width, height, data } = mask;
  const visited = new Int32Array(width * height); // 0 = unvisited, else region id
  let bestRegion = 0;
  let bestSize = -1;
  let nextRegion = 0;
  const stack: number[] = [];

  for (let start = 0; start < width * height; start++) {
    if (visited[start] !== 0 || data[start] <= threshold) continue;
    nextRegion++;
    let size = 0;
    stack.length = 0;
    stack.push(start);
    visited[start] = nextRegion;
    while (stack.length > 0) {
      const idx = stack.pop() as number;
      const x = idx % width;
      size++;
      const neighbors = [
        x > 0 ? idx - 1 : -1,
        x < width - 1 ? idx + 1 : -1,
        idx - width,
        idx + width,
      ];
      for (const n of neighbors) {
        if (n >= 0 && n < width * height && visited[n] === 0 && data[n] > threshold) {
          visited[n] = nextRegion;
          stack.push(n);
        }
      }
    }
    if (size > bestSize) {
      bestSize = size;
      bestRegion = nextRegion;
    }
  }

  const out = new Float32Array(width * height);
  if (bestSize > 0) {
    for (let i = 0; i < width * height; i++) {
      if (visited[i] === bestRegion) out[i] = data[i];
    }
  }
  return { width, height, data: out };
}

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

  // Keep only the main hair region (stray mask islands become floating
  // blobs in the shipped cutout otherwise), then feather its edge.
  const mainHair = keepLargestRegion(hairMask, opts.cropThreshold);
  const feathered = blurMask(mainHair, opts.featherRadius);

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

  // Revised gate (Iteration 5R round 2): whole-face backstop, inner-face
  // hard gate, and donor-space plausibility - see docs/HANDOFF.md's ROUND 2
  // ADDENDUM. Coverage numbers are pixel-identical whether measured in
  // cutout-space (here) or donor-space (cropping never resamples), but
  // plausibility MUST use the true donor dimensions/faceBox (pre-crop),
  // since cropping itself would otherwise distort the width-fraction and
  // vertical-position checks.
  const hairCoverageInFaceBox = computeAlphaCoverage(out, cutW, cutH, faceBox);
  const innerFaceCoverage = computeAlphaCoverage(out, cutW, cutH, computeInnerFaceBox(faceBox));
  const faceBoxPlausibility = checkFaceBoxPlausibility(faceBoxDonor, donorWidth, donorHeight);

  const gateReasons: string[] = [...faceBoxPlausibility.reasons];
  if (innerFaceCoverage >= INNER_FACE_MAX_COVERAGE) {
    gateReasons.push(
      `inner-face coverage ${innerFaceCoverage.toFixed(4)} >= ${INNER_FACE_MAX_COVERAGE}`
    );
  }
  if (hairCoverageInFaceBox >= WHOLE_FACE_MAX_COVERAGE) {
    gateReasons.push(
      `whole-face coverage ${hairCoverageInFaceBox.toFixed(4)} >= ${WHOLE_FACE_MAX_COVERAGE}`
    );
  }

  return {
    pixels: out,
    width: cutW,
    height: cutH,
    faceBox,
    hairCoverageInFaceBox,
    innerFaceCoverage,
    donorFaceBox: faceBoxDonor,
    donorWidth,
    donorHeight,
    faceBoxPlausibility,
    gatePass: gateReasons.length === 0,
    gateReasons,
  };
}
