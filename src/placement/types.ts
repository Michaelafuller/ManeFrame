/**
 * Pure geometry types for the hairstyle-overlay placement engine. No React,
 * no Skia — safe to unit test directly in Jest.
 */

/** A rectangle expressed as fractions (0..1) of some coordinate space's width/height. */
export interface NormalizedBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Axis-aligned scale + translate (no rotation), in absolute pixel units of
 * the destination (photo) coordinate space. Applying this to a point
 * `(px, py)` in the *source* (overlay) pixel space yields
 * `(px * scaleX + translateX, py * scaleY + translateY)` in photo-pixel
 * space.
 */
export interface AffineTransform {
  scaleX: number;
  scaleY: number;
  translateX: number;
  translateY: number;
}
