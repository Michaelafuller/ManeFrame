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
 * The bundled `selfie_multiclass_256x256.tflite` model's fixed input
 * resolution (confirmed by inspecting the model's flatbuffer: input tensor
 * `input_29` has shape [1, 256, 256, 3] - see docs/SUMMARY.md Iteration
 * 4R-5 for the full op-list dump). Exported so `tflite.ts` can fall back
 * to it if the runtime model metadata is ever unavailable.
 */
export const TFLITE_INPUT_SIZE = 256;

/**
 * Builds the model's expected input tensor from decoded RGBA_8888 photo
 * pixels: bilinear-resizes to `targetSize x targetSize`, normalizes RGB to
 * 0..1 float32, and - only when `channels` is 4 - appends a 4th
 * "previous mask" channel (always 0 for a still photo; still photos have
 * no previous frame to feed back).
 *
 * `channels` must be driven by the model's own runtime-reported input
 * shape (`model.inputs[0].shape`), not hardcoded, so this function keeps
 * working if a future model swap changes the channel count again:
 * `selfie_multiclass_256x256.tflite` (Iteration 4R-5) takes 3 channels
 * (plain RGB, no loopback channel); the earlier `hair_segmenter.tflite`
 * (MediaPipe's classic hair model, replaced in 4R-5 for its custom ops)
 * took 4.
 */
export function buildSegmenterInputTensor(
  pixels: Uint8Array,
  srcWidth: number,
  srcHeight: number,
  targetSize: number = TFLITE_INPUT_SIZE,
  channels: 3 | 4 = 3
): Float32Array {
  if (channels !== 3 && channels !== 4) {
    throw new Error(`Unsupported input channel count: ${channels} (expected 3 or 4).`);
  }

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

  if (channels === 3) {
    return resizedRgb;
  }

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
 * - `channels >= 2`: a categorical map over multiple classes. `hairChannel`
 *   selects which channel index is "hair" (default 1). `outputsAreProbabilities`
 *   says whether the graph already ends in a softmax (values already sum to
 *   1 across channels, so `hairChannel` is used directly, clamped 0..1) or
 *   not (raw per-class logits, so softmax is applied across the channel
 *   axis first and the "hair" class's softmax probability is used).
 *
 * The bundled `selfie_multiclass_256x256.tflite` (Iteration 4R-5) is the
 * second case: inspecting its flatbuffer shows the output tensor `Identity`
 * has shape [1, 256, 256, 6] and the graph's *last* op is `CONV_2D` (not
 * `SOFTMAX` - the SOFTMAX ops present elsewhere in the graph belong to
 * internal attention blocks, not the final classification head) - see
 * docs/SUMMARY.md Iteration 4R-5 for the full op-list dump. So these are
 * raw per-class logits needing client-side softmax, and per MediaPipe's
 * documented category order (`background, hair, body-skin, face-skin,
 * clothes, others`) channel index 1 is "hair" - both the defaults below.
 *
 * The earlier `hair_segmenter.tflite` (replaced in 4R-5 for its custom
 * ops) was also logits, 2-channel `[background, hair]` - i.e.
 * `outputsAreProbabilities: false, hairChannel: 1` there too, just with a
 * different channel count.
 */
export function tensorToHairMask(
  tensor: Float32Array,
  width: number,
  height: number,
  channels: number,
  hairChannel: number = 1,
  outputsAreProbabilities: boolean = false
): HairMask {
  if (channels < 1) {
    throw new Error(`Unsupported tensor channel count: ${channels}`);
  }

  const pixelCount = width * height;
  const data = new Float32Array(pixelCount);

  if (channels === 1) {
    // Single-channel confidence map: `hairChannel` is meaningless here (only
    // one channel exists), so it's intentionally not range-checked.
    for (let i = 0; i < pixelCount; i++) {
      data[i] = clamp01(tensor[i]);
    }
    return { width, height, data };
  }

  if (hairChannel < 0 || hairChannel >= channels) {
    throw new Error(`hairChannel ${hairChannel} out of range for ${channels} channel(s).`);
  }

  if (outputsAreProbabilities) {
    // Graph already ends in softmax (or equivalent): channels already sum
    // to ~1, so just read the hair channel directly.
    for (let i = 0; i < pixelCount; i++) {
      data[i] = clamp01(tensor[i * channels + hairChannel]);
    }
    return { width, height, data };
  }

  // Categorical logits: softmax across channels, take the hair class.
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
      if (c === hairChannel) hairExp = e;
    }
    data[i] = sum > 0 ? hairExp / sum : 0;
  }
  return { width, height, data };
}
