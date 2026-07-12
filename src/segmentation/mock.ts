/**
 * MockHairSegmenter: a deterministic, geometry-only stand-in for a real
 * hair-segmentation model. Produces a soft "hair cap" mask (an ellipse
 * around the top of the head) with a face-shaped cutout carved out of it,
 * so cheeks don't recolor but the hairline above the face survives.
 *
 * Ignores the actual photo pixels entirely (the real M4 tflite segmenter
 * will use them) - the interface still accepts `pixels` so callers don't
 * need to change when it's swapped in.
 *
 * Pure functions, no React imports.
 */

import type { DualMaskSegmenter, FaceMask, HairMask, HairSegmenter } from './types';

/** Mask never exceeds this on its long side (preserves aspect, may be smaller). */
const MAX_MASK_DIMENSION = 256;

/** Hair-cap ellipse, as fractions of mask width/height. */
const HAIR_CENTER_X_FRAC = 0.5;
const HAIR_CENTER_Y_FRAC = 0.38;
const HAIR_RADIUS_X_FRAC = 0.34;
const HAIR_RADIUS_Y_FRAC = 0.3;
/** Falloff band around the hair-cap boundary, as a fraction of mask width. */
const HAIR_EDGE_BAND_FRAC = 0.08;

/** Face cutout ellipse, as fractions of mask width/height. */
const FACE_CENTER_X_FRAC = 0.5;
const FACE_CENTER_Y_FRAC = 0.48;
const FACE_RADIUS_X_FRAC = 0.2;
const FACE_RADIUS_Y_FRAC = 0.22;
/** Falloff band around the face-cutout boundary, as a fraction of mask width. */
const FACE_EDGE_BAND_FRAC = 0.05;
/** How much the mask is attenuated at the center of the face cutout. */
const FACE_ATTENUATION = 0.1;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/** Classic smoothstep: 0 below edge0, 1 above edge1, smooth (cubic) between. */
function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge0 === edge1) return x < edge0 ? 0 : 1;
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/**
 * Face-skin mask value at one pixel: 1 inside the same face ellipse used
 * above to cut a hole out of the hair-cap mask, smoothly falling to 0
 * outside it. This is the mock stand-in for the real segmenter's
 * face-skin channel (Iteration 5 / M6's placement engine input) — it
 * deliberately reuses the exact same ellipse geometry as the hair-cap
 * cutout above, so the mock's "face" and "hair" masks are geometrically
 * consistent with each other the same way the real model's channels are.
 */
function faceMaskValueAt(x: number, y: number, width: number, height: number): number {
  const faceCx = FACE_CENTER_X_FRAC * width;
  const faceCy = FACE_CENTER_Y_FRAC * height;
  const faceRx = FACE_RADIUS_X_FRAC * width;
  const faceRy = FACE_RADIUS_Y_FRAC * height;
  const faceBand = FACE_EDGE_BAND_FRAC * width;
  const faceBandFrac = faceBand / ((faceRx + faceRy) / 2);

  const faceR = ellipseRadius(x, y, faceCx, faceCy, faceRx, faceRy);
  return clamp01(1 - smoothstep(1 - faceBandFrac, 1 + faceBandFrac, faceR));
}

/**
 * Normalized elliptical radius: 0 at (cx,cy), 1 exactly on the ellipse
 * boundary, growing beyond 1 outside it.
 */
function ellipseRadius(
  x: number,
  y: number,
  cx: number,
  cy: number,
  rx: number,
  ry: number
): number {
  const dx = (x - cx) / rx;
  const dy = (y - cy) / ry;
  return Math.sqrt(dx * dx + dy * dy);
}

function computeMaskDimensions(
  imageWidth: number,
  imageHeight: number
): { width: number; height: number } {
  const longSide = Math.max(imageWidth, imageHeight);
  const scale = Math.min(1, MAX_MASK_DIMENSION / longSide);
  return {
    width: Math.max(1, Math.round(imageWidth * scale)),
    height: Math.max(1, Math.round(imageHeight * scale)),
  };
}

/** Computes the deterministic hair-cap-minus-face mask for one pixel. */
function maskValueAt(x: number, y: number, width: number, height: number): number {
  const hairCx = HAIR_CENTER_X_FRAC * width;
  const hairCy = HAIR_CENTER_Y_FRAC * height;
  const hairRx = HAIR_RADIUS_X_FRAC * width;
  const hairRy = HAIR_RADIUS_Y_FRAC * height;
  const hairBand = HAIR_EDGE_BAND_FRAC * width;
  const hairBandFrac = hairBand / ((hairRx + hairRy) / 2);

  const hairR = ellipseRadius(x, y, hairCx, hairCy, hairRx, hairRy);
  const hairValue =
    1 - smoothstep(1 - hairBandFrac, 1 + hairBandFrac, hairR);

  const faceCx = FACE_CENTER_X_FRAC * width;
  const faceCy = FACE_CENTER_Y_FRAC * height;
  const faceRx = FACE_RADIUS_X_FRAC * width;
  const faceRy = FACE_RADIUS_Y_FRAC * height;
  const faceBand = FACE_EDGE_BAND_FRAC * width;
  const faceBandFrac = faceBand / ((faceRx + faceRy) / 2);

  const faceR = ellipseRadius(x, y, faceCx, faceCy, faceRx, faceRy);
  // 1.0 (no attenuation) outside the face ellipse, FACE_ATTENUATION at its
  // center, smoothly interpolated across the band.
  const faceAttenuation = mix(
    FACE_ATTENUATION,
    1,
    smoothstep(1 - faceBandFrac, 1 + faceBandFrac, faceR)
  );

  return clamp01(hairValue * faceAttenuation);
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export class MockHairSegmenter implements HairSegmenter, DualMaskSegmenter {
  readonly name = 'mock-hair-cap';

  segment(
    imageWidth: number,
    imageHeight: number,
    _pixels: Uint8Array | null
  ): Promise<HairMask> {
    const { width, height } = computeMaskDimensions(imageWidth, imageHeight);
    const data = new Float32Array(width * height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        data[y * width + x] = maskValueAt(x + 0.5, y + 0.5, width, height);
      }
    }

    return Promise.resolve({ width, height, data });
  }

  /**
   * Same hair mask as `segment()`, plus a face-skin mask from the same
   * ellipse geometry (see `faceMaskValueAt`) — the mock stand-in for the
   * real segmenter's `segmentBoth`, used by the M6 placement engine.
   */
  async segmentBoth(
    imageWidth: number,
    imageHeight: number,
    pixels: Uint8Array | null
  ): Promise<{ hair: HairMask; face: FaceMask }> {
    const hair = await this.segment(imageWidth, imageHeight, pixels);
    const { width, height } = hair;
    const faceData = new Float32Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        faceData[y * width + x] = faceMaskValueAt(x + 0.5, y + 0.5, width, height);
      }
    }
    return { hair, face: { width, height, data: faceData } };
  }
}
