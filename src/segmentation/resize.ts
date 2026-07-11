/**
 * Pure-TS bilinear image resize over interleaved-channel Float32 data.
 * Used to resize decoded photo pixels to a tflite model's fixed input
 * resolution (and could equally resize a model's output mask, if ever
 * needed) without depending on any native/image library.
 *
 * No React, no native modules - safe to unit test directly in Jest.
 */

/**
 * Resizes a row-major, interleaved-channel Float32 image from
 * `srcWidth x srcHeight` to `dstWidth x dstHeight`, using bilinear
 * interpolation with "align corners" sample-point mapping: the first
 * destination pixel samples exactly the first source pixel, and the last
 * destination pixel samples exactly the last source pixel (in each
 * dimension). This keeps resizes deterministic and easy to hand-verify.
 *
 * `channels` is the number of interleaved values per pixel (e.g. 3 for
 * RGB, 4 for RGBA); every channel is resized independently using the same
 * spatial sample point.
 */
export function bilinearResize(
  src: Float32Array,
  srcWidth: number,
  srcHeight: number,
  channels: number,
  dstWidth: number,
  dstHeight: number
): Float32Array {
  const dst = new Float32Array(dstWidth * dstHeight * channels);
  if (srcWidth < 1 || srcHeight < 1 || dstWidth < 1 || dstHeight < 1) {
    return dst;
  }

  const scaleX = dstWidth > 1 ? (srcWidth - 1) / (dstWidth - 1) : 0;
  const scaleY = dstHeight > 1 ? (srcHeight - 1) / (dstHeight - 1) : 0;

  for (let dy = 0; dy < dstHeight; dy++) {
    const sy = dstHeight > 1 ? dy * scaleY : (srcHeight - 1) / 2;
    const y0 = Math.floor(sy);
    const y1 = Math.min(srcHeight - 1, y0 + 1);
    const fy = sy - y0;

    for (let dx = 0; dx < dstWidth; dx++) {
      const sx = dstWidth > 1 ? dx * scaleX : (srcWidth - 1) / 2;
      const x0 = Math.floor(sx);
      const x1 = Math.min(srcWidth - 1, x0 + 1);
      const fx = sx - x0;

      const dstBase = (dy * dstWidth + dx) * channels;
      const row0Base0 = (y0 * srcWidth + x0) * channels;
      const row0Base1 = (y0 * srcWidth + x1) * channels;
      const row1Base0 = (y1 * srcWidth + x0) * channels;
      const row1Base1 = (y1 * srcWidth + x1) * channels;

      for (let c = 0; c < channels; c++) {
        const v00 = src[row0Base0 + c];
        const v10 = src[row0Base1 + c];
        const v01 = src[row1Base0 + c];
        const v11 = src[row1Base1 + c];
        const top = v00 + (v10 - v00) * fx;
        const bottom = v01 + (v11 - v01) * fx;
        dst[dstBase + c] = top + (bottom - top) * fy;
      }
    }
  }

  return dst;
}
