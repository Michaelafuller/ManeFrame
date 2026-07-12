/**
 * Placement engine: turns a face-skin probability mask (segmentation
 * channel 3 of `selfie_multiclass_256x256.tflite`, or the mock
 * equivalent) into an on-photo transform for a hairstyle overlay asset.
 *
 * Pure functions, no React/Skia imports — safe to unit test directly in
 * Jest. Three steps, each independently testable:
 *
 *   1. `computeMaskBoundingBox` — threshold + largest-connected-region
 *      bounding box (simple flood fill), in normalized (0..1) coordinates.
 *      Works on any mask (face mask for placement; also reused for the
 *      hair mask when comparing overlay size against the detected hair
 *      region — see `docs/HANDOFF.md`'s "known limitation" note).
 *   2. `computeHeadBox` — expands a face box into a head box (scalp
 *      extends above the face; modest side padding for hair volume/ears),
 *      clamped to stay within the photo (handles off-center faces and
 *      faces near frame edges).
 *   3. `computeOverlayTransform` — the affine (scale+translate, no
 *      rotation) mapping an overlay asset's own `headBox` anchor onto a
 *      target head box, in absolute photo-pixel units.
 */

import type { HairMask } from '../segmentation/types';
import type { AffineTransform, NormalizedBox } from './types';

const DEFAULT_THRESHOLD = 0.5;

/**
 * How far the head box extends above the detected face box, as a fraction
 * of the face box's own height. HANDOFF guidance: "scalp extends above the
 * face box ~40-60% of its height" — 0.5 is the midpoint of that range.
 */
export const SCALP_HEIGHT_FRACTION = 0.5;

/**
 * Modest side padding (fraction of face box width, applied to each side)
 * so the head box comfortably covers hair volume and ears, not just the
 * bare face-skin oval. Not specified numerically in the HANDOFF; chosen
 * conservatively so overlay art isn't systematically clipped at the
 * temples on typical face proportions.
 */
export const HEAD_WIDTH_PADDING_FRACTION = 0.15;

/**
 * Largest 4-connected region of `mask` values strictly greater than
 * `threshold`, as a normalized (0..1) bounding box in the mask's own
 * coordinate space. Returns `null` if no pixel exceeds the threshold (no
 * face/hair detected). Iterative (stack-based) flood fill — no recursion,
 * safe for a full 256x256 mask.
 */
export function computeMaskBoundingBox(
  mask: HairMask,
  threshold: number = DEFAULT_THRESHOLD
): NormalizedBox | null {
  const { width, height, data } = mask;
  if (width <= 0 || height <= 0 || data.length < width * height) {
    return null;
  }

  const visited = new Uint8Array(width * height);
  let bestSize = -1;
  let bestMinX = 0;
  let bestMinY = 0;
  let bestMaxX = 0;
  let bestMaxY = 0;

  const stack: number[] = [];

  for (let start = 0; start < width * height; start++) {
    if (visited[start] || data[start] <= threshold) continue;

    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    let size = 0;

    stack.length = 0;
    stack.push(start);
    visited[start] = 1;

    while (stack.length > 0) {
      const idx = stack.pop() as number;
      const x = idx % width;
      const y = (idx - x) / width;
      size++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;

      if (x > 0) {
        const n = idx - 1;
        if (!visited[n] && data[n] > threshold) {
          visited[n] = 1;
          stack.push(n);
        }
      }
      if (x < width - 1) {
        const n = idx + 1;
        if (!visited[n] && data[n] > threshold) {
          visited[n] = 1;
          stack.push(n);
        }
      }
      if (y > 0) {
        const n = idx - width;
        if (!visited[n] && data[n] > threshold) {
          visited[n] = 1;
          stack.push(n);
        }
      }
      if (y < height - 1) {
        const n = idx + width;
        if (!visited[n] && data[n] > threshold) {
          visited[n] = 1;
          stack.push(n);
        }
      }
    }

    if (size > bestSize) {
      bestSize = size;
      bestMinX = minX;
      bestMinY = minY;
      bestMaxX = maxX;
      bestMaxY = maxY;
    }
  }

  if (bestSize <= 0) return null;

  return {
    x: bestMinX / width,
    y: bestMinY / height,
    w: (bestMaxX - bestMinX + 1) / width,
    h: (bestMaxY - bestMinY + 1) / height,
  };
}

/**
 * Expands a normalized face bounding box into a "head box": scalp extends
 * `SCALP_HEIGHT_FRACTION` of the face box's height above it, sides pad out
 * by `HEAD_WIDTH_PADDING_FRACTION` of the face box's width on each side.
 * Clamps the result to stay within `[0,1]` on both axes by shrinking
 * (never shifting) the box, so it never claims to cover area outside the
 * photo — handles off-center faces and faces near frame edges.
 */
export function computeHeadBox(faceBox: NormalizedBox): NormalizedBox {
  const padW = faceBox.w * HEAD_WIDTH_PADDING_FRACTION;
  const scalpExtra = faceBox.h * SCALP_HEIGHT_FRACTION;

  let x = faceBox.x - padW;
  let w = faceBox.w + padW * 2;
  let y = faceBox.y - scalpExtra;
  let h = faceBox.h + scalpExtra;

  if (x < 0) {
    w += x; // shrink by the overshoot
    x = 0;
  }
  if (y < 0) {
    h += y;
    y = 0;
  }
  if (x + w > 1) {
    w = 1 - x;
  }
  if (y + h > 1) {
    h = 1 - y;
  }

  return {
    x,
    y,
    w: Math.max(0, w),
    h: Math.max(0, h),
  };
}

/**
 * Computes the affine (axis-aligned scale + translate, no rotation)
 * transform mapping an overlay asset's own `headBox` anchor (normalized,
 * in the overlay's `overlayWidth x overlayHeight` pixel space) onto
 * `targetHeadBox` (normalized, in `photoWidth x photoHeight` photo-pixel
 * space). A renderer can draw the overlay's raster directly at
 * `{ x: translateX, y: translateY, width: overlayWidth * scaleX, height:
 * overlayHeight * scaleY }` in photo-pixel space.
 *
 * Non-uniform scale (independent X/Y) is used deliberately: it maps the
 * overlay's headBox rectangle exactly onto the detected head box
 * rectangle regardless of aspect-ratio mismatch between the two, which is
 * the literal placement contract. Manual nudge controls (scale/move) let
 * the user correct any resulting stretch.
 */
export function computeOverlayTransform(
  overlayHeadBox: NormalizedBox,
  overlayWidth: number,
  overlayHeight: number,
  targetHeadBox: NormalizedBox,
  photoWidth: number,
  photoHeight: number
): AffineTransform {
  const targetPx = {
    x: targetHeadBox.x * photoWidth,
    y: targetHeadBox.y * photoHeight,
    w: targetHeadBox.w * photoWidth,
    h: targetHeadBox.h * photoHeight,
  };
  const overlayHeadPx = {
    x: overlayHeadBox.x * overlayWidth,
    y: overlayHeadBox.y * overlayHeight,
    w: overlayHeadBox.w * overlayWidth,
    h: overlayHeadBox.h * overlayHeight,
  };

  const scaleX = overlayHeadPx.w > 0 ? targetPx.w / overlayHeadPx.w : 1;
  const scaleY = overlayHeadPx.h > 0 ? targetPx.h / overlayHeadPx.h : 1;
  const translateX = targetPx.x - overlayHeadPx.x * scaleX;
  const translateY = targetPx.y - overlayHeadPx.y * scaleY;

  return { scaleX, scaleY, translateX, translateY };
}

/**
 * End-to-end convenience: face mask -> face box -> head box -> overlay
 * transform. Returns `null` when no face is detected (mask has no pixel
 * above `threshold`), which callers should surface as "No face detected -
 * try a front-facing photo" rather than an error.
 */
export function computePlacementFromFaceMask(
  faceMask: HairMask,
  overlayHeadBox: NormalizedBox,
  overlayWidth: number,
  overlayHeight: number,
  photoWidth: number,
  photoHeight: number,
  threshold: number = DEFAULT_THRESHOLD
): AffineTransform | null {
  const faceBox = computeMaskBoundingBox(faceMask, threshold);
  if (!faceBox) return null;
  const headBox = computeHeadBox(faceBox);
  return computeOverlayTransform(
    overlayHeadBox,
    overlayWidth,
    overlayHeight,
    headBox,
    photoWidth,
    photoHeight
  );
}
