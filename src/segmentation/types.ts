/**
 * Segmentation interface: produces a per-pixel "how likely is this hair"
 * probability mask for a photo. Implementations may run entirely on-device
 * (mock, geometric placeholder) or via a real model (M4, tflite).
 *
 * Pure types + interface, no React imports.
 */

export interface HairMask {
  width: number; // mask resolution (may be smaller than photo)
  height: number;
  data: Float32Array; // row-major, length = width*height, values 0..1
}

export interface HairSegmenter {
  readonly name: string;
  segment(
    imageWidth: number,
    imageHeight: number,
    pixels: Uint8Array | null
  ): Promise<HairMask>;
}

/**
 * A face-skin probability mask — structurally identical to `HairMask`
 * (same {width, height, data} shape), aliased separately so call sites
 * documenting "this is the placement-engine input, not the hair-recolor
 * input" read clearly.
 */
export type FaceMask = HairMask;

/**
 * Optional capability implemented by segmenters that can produce both the
 * hair mask and the face-skin mask from a single underlying pass (the real
 * `selfie_multiclass_256x256.tflite` model outputs both channels from one
 * inference call; the mock derives both from the same geometric ellipses).
 * Added for Iteration 5 (M6 hairstyle overlays) — the placement engine
 * needs a face-skin mask to compute where a style's headBox anchor should
 * sit, without disturbing the existing `HairSegmenter.segment()` contract
 * that everything else in the app already depends on.
 */
export interface DualMaskSegmenter {
  segmentBoth(
    imageWidth: number,
    imageHeight: number,
    pixels: Uint8Array | null
  ): Promise<{ hair: HairMask; face: FaceMask }>;
}
