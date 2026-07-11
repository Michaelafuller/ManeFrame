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
