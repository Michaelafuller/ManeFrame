/**
 * Orchestrates "try the real segmenter, fall back to the mock one if it
 * fails" without any React - so it's directly unit-testable with stubbed
 * `HairSegmenter` implementations, independent of `PreviewScreen`'s UI.
 */

import type { DualMaskSegmenter, FaceMask, HairMask, HairSegmenter } from './types';

export interface SegmentWithFallbackResult {
  mask: HairMask;
  /** True if `primary` threw and `fallback` had to be used instead. */
  usedFallback: boolean;
  /** The error message from `primary`, only set when `usedFallback` is true. */
  error?: string;
  /**
   * The raw value `primary` threw/rejected with (only set when
   * `usedFallback` is true). Exposed alongside the flattened `error`
   * string so callers that want the full chain (message + `cause`, e.g.
   * for logcat) can walk it themselves - `error` alone loses any `cause`
   * on an `Error`.
   */
  rawError?: unknown;
}

/**
 * Runs `primary.segment(...)`. If construction/inference throws (of any
 * kind - model load failure, unexpected tensor shape, native inference
 * error), swallows the error and runs `fallback.segment(...)` instead,
 * reporting that a fallback occurred so the UI can show a visible badge.
 */
export async function segmentWithFallback(
  primary: HairSegmenter,
  fallback: HairSegmenter,
  imageWidth: number,
  imageHeight: number,
  pixels: Uint8Array | null
): Promise<SegmentWithFallbackResult> {
  try {
    const mask = await primary.segment(imageWidth, imageHeight, pixels);
    return { mask, usedFallback: false };
  } catch (e) {
    const mask = await fallback.segment(imageWidth, imageHeight, pixels);
    return {
      mask,
      usedFallback: true,
      error: e instanceof Error ? e.message : String(e),
      rawError: e,
    };
  }
}

export interface SegmentBothWithFallbackResult {
  hair: HairMask;
  face: FaceMask;
  /** True if `primary` threw and `fallback` had to be used instead. */
  usedFallback: boolean;
  /** The error message from `primary`, only set when `usedFallback` is true. */
  error?: string;
  /** The raw value `primary` threw/rejected with, only set when `usedFallback` is true. */
  rawError?: unknown;
}

/**
 * Same fallback contract as `segmentWithFallback`, for segmenters that
 * additionally produce a face-skin mask (`DualMaskSegmenter`, added for
 * Iteration 5 / M6's placement engine). Kept as a separate function
 * (rather than generalizing `segmentWithFallback`) so the existing,
 * already-tested single-mask call sites and their tests are untouched.
 */
export async function segmentBothWithFallback(
  primary: DualMaskSegmenter,
  fallback: DualMaskSegmenter,
  imageWidth: number,
  imageHeight: number,
  pixels: Uint8Array | null
): Promise<SegmentBothWithFallbackResult> {
  try {
    const { hair, face } = await primary.segmentBoth(imageWidth, imageHeight, pixels);
    return { hair, face, usedFallback: false };
  } catch (e) {
    const { hair, face } = await fallback.segmentBoth(imageWidth, imageHeight, pixels);
    return {
      hair,
      face,
      usedFallback: true,
      error: e instanceof Error ? e.message : String(e),
      rawError: e,
    };
  }
}
