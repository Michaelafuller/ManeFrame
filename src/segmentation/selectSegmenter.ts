/**
 * Orchestrates "try the real segmenter, fall back to the mock one if it
 * fails" without any React - so it's directly unit-testable with stubbed
 * `HairSegmenter` implementations, independent of `PreviewScreen`'s UI.
 */

import type { HairMask, HairSegmenter } from './types';

export interface SegmentWithFallbackResult {
  mask: HairMask;
  /** True if `primary` threw and `fallback` had to be used instead. */
  usedFallback: boolean;
  /** The error message from `primary`, only set when `usedFallback` is true. */
  error?: string;
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
    };
  }
}
