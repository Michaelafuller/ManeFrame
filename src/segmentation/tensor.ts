/**
 * Pure-TS conversions between the tflite hair-segmentation model's raw
 * tensors and this app's own types (`Uint8Array` RGBA pixels <-> the
 * model's float32 NHWC input tensor; the model's float32 output tensor ->
 * `HairMask`).
 *
 * No React, no native modules - safe to unit test directly in Jest. Real
 * inference (`model.run(...)`) only ever happens in `tflite.ts`.
 */

import { bilinearResize } from './resize';
import type { HairMask } from './types';

/**
 * The bundled hair_segmenter.tflite model's fixed input resolution
 * (confirmed by inspecting the model's flatbuffer: input tensor `input_1`
 * has shape [1, 512, 512, 4]). Exported so `tflite.ts` can fall back to it
 * if the runtime model metadata is ever unavailable.
 */
export const TFLITE_INPUT_SIZE = 512;

/**
 * Builds the model's expected input tensor from decoded RGBA_8888 photo
 * pixels: bilinear-resizes to `targetSize x targetSize`, normalizes RGB to
 * 0..1 float32, and appends a 4th "previous mask" channel.
 *
 * The bundled model takes 4 input channels (RGB + a previous-frame hair
 * mask) because MediaPipe's hair segmentation graph feeds the prior
 * frame's output back in as the 4th channel for temporal smoothing in
 * video (see hair_segmentation_mobile_gpu.pbtxt's `PreviousLoopbackCalculator`).
 * Still photos have no previous frame, so this channel is always 0 - the
 * same zero-filled value MediaPipe's own graph uses to "jump start" the
 * very first frame.
 */
export function buildSegmenterInputTensor(
  pixels: Uint8Array,
  srcWidth: number,
  srcHeight: number,
  targetSize: number = TFLITE_INPUT_SIZE
): Float32Array {
  const pixelCount = srcWidth * srcHeight;
  const rgbFloat = new Float32Array(pixelCount * 3);
  for (let i = 0; i < pixelCount; i++) {
    rgbFloat[i * 3 + 0] = pixels[i * 4 + 0] / 255;
    rgbFloat[i * 3 + 1] = pixels[i * 4 + 1] / 255;
    rgbFloat[i * 3 + 2] = pixels[i * 4 + 2] / 255;
  }

  const resizedRgb = bilinearResize(
    rgbFloat,
    srcWidth,
    srcHeight,
    3,
    targetSize,
    targetSize
  );

  const tensor = new Float32Array(targetSize * targetSize * 4);
  for (let i = 0; i < targetSize * targetSize; i++) {
    tensor[i * 4 + 0] = resizedRgb[i * 3 + 0];
    tensor[i * 4 + 1] = resizedRgb[i * 3 + 1];
    tensor[i * 4 + 2] = resizedRgb[i * 3 + 2];
    tensor[i * 4 + 3] = 0; // previous-mask channel; always 0 for a still photo
  }
  return tensor;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Converts the model's raw output tensor into a `HairMask` (0..1 per
 * pixel). Handles both plausible output layouts a segmentation model like
 * this could ship with:
 *
 * - `channels === 1`: a direct confidence/probability map - each value is
 *   already (assumed to be) in 0..1 and is simply clamped.
 * - `channels >= 2`: a categorical map of per-class logits - softmax is
 *   applied across the channel axis and the "hair" class's probability is
 *   used as the mask value.
 *
 * The bundled hair_segmenter.tflite is the second case: inspecting its
 * flatbuffer shows the output tensor `conv2d_transpose_4` has shape
 * [1, 512, 512, 2] (no trailing softmax op - the last op that produces it
 * is a custom transpose-conv), and its embedded `labels.txt` metadata lists
 * two categories in channel order `background, hair`. So channel index 1
 * is "hair", and its softmax probability is what this function returns.
 */
export function tensorToHairMask(
  tensor: Float32Array,
  width: number,
  height: number,
  channels: number
): HairMask {
  if (channels < 1) {
    throw new Error(`Unsupported tensor channel count: ${channels}`);
  }

  const pixelCount = width * height;
  const data = new Float32Array(pixelCount);

  if (channels === 1) {
    for (let i = 0; i < pixelCount; i++) {
      data[i] = clamp01(tensor[i]);
    }
    return { width, height, data };
  }

  // Categorical: softmax across channels, take the "hair" class (index 1).
  const HAIR_CLASS_INDEX = 1;
  for (let i = 0; i < pixelCount; i++) {
    const base = i * channels;
    let maxLogit = -Infinity;
    for (let c = 0; c < channels; c++) {
      const v = tensor[base + c];
      if (v > maxLogit) maxLogit = v;
    }
    let sum = 0;
    let hairExp = 0;
    for (let c = 0; c < channels; c++) {
      const e = Math.exp(tensor[base + c] - maxLogit);
      sum += e;
      if (c === HAIR_CLASS_INDEX) hairExp = e;
    }
    data[i] = sum > 0 ? hairExp / sum : 0;
  }
  return { width, height, data };
}
