/**
 * Real hair segmentation via Google's MediaPipe Image Segmenter
 * `selfie_multiclass_256x256.tflite` model, run on-device through
 * `react-native-fast-tflite`.
 *
 * Iteration 4R-5 swapped this in for the classic `hair_segmenter.tflite`:
 * that model requires MediaPipe's custom TFLite ops
 * (`MaxPoolingWithArgmax2D` et al.), which vanilla `react-native-fast-tflite`
 * cannot register (see docs/REMEDIATION.md). This replacement's op list was
 * verified custom-op-free before integration - see docs/SUMMARY.md
 * Iteration 4R-5 for the full flatbuffer dump. Its 6 output categories are
 * `background, hair, body-skin, face-skin, clothes, others` (channel 1 is
 * hair), and the graph's last op is `CONV_2D` (not `SOFTMAX`) so the output
 * is raw per-class logits requiring client-side softmax - hence
 * `MODEL_OUTPUTS_ARE_PROBABILITIES = false` below.
 *
 * This file is the only place in `src/segmentation` that touches a native
 * module - everything it depends on (`buildSegmenterInputTensor`,
 * `tensorToHairMask`) is pure TS and unit-tested separately. Real
 * inference only runs on a physical/emulated device with the custom dev
 * client installed; it is never exercised in Jest (see the root
 * `__mocks__/react-native-fast-tflite.js` stub used for tests).
 */

import { Asset } from 'expo-asset';
import { loadTensorflowModel, type TfliteModel } from 'react-native-fast-tflite';

import hairSegmenterModelAsset from '../../assets/models/selfie_multiclass_256x256.tflite';
import { buildSegmenterInputTensor, TFLITE_INPUT_SIZE, tensorToHairMask } from './tensor';
import type { DualMaskSegmenter, FaceMask, HairMask, HairSegmenter } from './types';

/**
 * Hardcoded for `selfie_multiclass_256x256.tflite` specifically, per the
 * op-list/output-tensor determination in docs/SUMMARY.md Iteration 4R-5:
 * the graph's last op is `CONV_2D`, not `SOFTMAX`, so channel values are
 * raw logits and must be softmaxed client-side (`tensorToHairMask` does
 * this when `false`). Update this comment (and re-verify via the
 * flatbuffer op list) if the model is ever swapped again.
 */
const MODEL_OUTPUTS_ARE_PROBABILITIES = false;
/** MediaPipe's documented category order for this model: index 1 is "hair". */
const MODEL_HAIR_CHANNEL = 1;
/**
 * MediaPipe's documented category order for this model
 * (`background, hair, body-skin, face-skin, clothes, others`): index 3 is
 * "face-skin" — used by the Iteration 5 / M6 placement engine to locate
 * the wearer's head, not for hair recoloring.
 */
const MODEL_FACE_CHANNEL = 3;

/** Thrown for any model load or inference failure. Never lets the UI crash. */
export class TfliteSegmentationError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'TfliteSegmentationError';
    if (cause !== undefined) {
      (this as { cause?: unknown }).cause = cause;
    }
  }
}

/**
 * Minimal shape of the object `Asset.fromModule(...)` returns - narrowed to
 * just what `resolveModelSource` needs so it can be unit-tested with a
 * plain stub instead of the real `expo-asset` module (which requires a
 * native module and can't run under Jest).
 */
export interface ModuleAssetLike {
  localUri: string | null;
  downloadAsync(): Promise<unknown>;
}

/**
 * Resolves a Metro asset module (a `require(...)`-style numeric id) to a
 * local file URI usable by `loadTensorflowModel`.
 *
 * In DEV, Metro serves assets over `http://.../assets/...` and
 * `Image.resolveAssetSource` alone is enough - fast-tflite's own loader
 * handles that case fine. In RELEASE builds the same resolution instead
 * yields an Android resource reference the native `AssetLoader` cannot
 * open, so the model silently fails to load (see docs/REMEDIATION.md
 * Iteration 4R-4). Routing through `expo-asset`'s `downloadAsync` - which
 * copies the bundled resource to a real file:// path on first use - fixes
 * this in both DEV and RELEASE.
 */
export async function resolveModelSource(asset: ModuleAssetLike): Promise<{ url: string }> {
  if (!asset.localUri) {
    await asset.downloadAsync();
  }
  if (!asset.localUri) {
    throw new TfliteSegmentationError(
      'expo-asset could not resolve a local file URI for the hair segmentation model ' +
        '(localUri was null after downloadAsync()).'
    );
  }
  // Mirrors fast-tflite's own "Resolved Model path: ..." log (which never
  // fires for the `{ url }` source form we now use) so logcat still shows
  // where the model file actually came from - useful before/after evidence
  // for docs/REMEDIATION.md Iteration 4R-4.
  console.log(`[tflite] Resolved model localUri (expo-asset): ${asset.localUri}`);
  return { url: asset.localUri };
}

// Lazy singleton: the model is only loaded once, on first use, and shared
// across every `TfliteHairSegmenter` instance/call.
let modelPromise: Promise<TfliteModel> | null = null;

function loadModel(): Promise<TfliteModel> {
  if (!modelPromise) {
    modelPromise = (async () => {
      const rawAsset = Asset.fromModule(hairSegmenterModelAsset);
      const source = await resolveModelSource(rawAsset);
      return loadTensorflowModel(source, []);
    })().catch((e: unknown) => {
      // Allow a later call to retry loading rather than permanently
      // failing every subsequent segment() call in the same app session.
      modelPromise = null;
      throw e;
    });
  }
  return modelPromise;
}

/**
 * Dev-only diagnostic: min/max/mean over `values` (or a `sampleCount`-sized
 * prefix, to keep this cheap on a 256*256*6 ≈ 393k-value output tensor).
 * Never runs in production - every call site is gated by `if (__DEV__)`.
 */
function statsOf(
  values: Float32Array,
  sampleCount: number = values.length
): { min: number; max: number; mean: number; n: number } {
  const n = Math.min(sampleCount, values.length);
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const v = values[i];
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
  }
  return { min, max, mean: n > 0 ? sum / n : NaN, n };
}

export class TfliteHairSegmenter implements HairSegmenter, DualMaskSegmenter {
  readonly name = 'tflite-hair-segmenter';

  /**
   * Runs inference once and extracts BOTH the hair mask and the face-skin
   * mask from the same output tensor (added for Iteration 5 / M6's
   * placement engine — no extra inference pass needed, since both channels
   * come from the same [1,256,256,6] output). `segment()` below is kept
   * for backward compatibility with every existing `HairSegmenter` call
   * site and just returns `.hair` from this.
   */
  async segmentBoth(
    imageWidth: number,
    imageHeight: number,
    pixels: Uint8Array | null
  ): Promise<{ hair: HairMask; face: FaceMask }> {
    if (!pixels) {
      throw new TfliteSegmentationError(
        'TfliteHairSegmenter requires decoded pixel data (got null).'
      );
    }

    let model: TfliteModel;
    try {
      model = await loadModel();
    } catch (e) {
      throw new TfliteSegmentationError('Failed to load the hair segmentation model.', e);
    }

    const inputInfo = model.inputs[0];
    const inputChannels = inputInfo?.shape?.[3];
    const isValidInputShape =
      inputInfo &&
      inputInfo.shape.length === 4 &&
      (inputChannels === 3 || inputChannels === 4);
    const inputSize = isValidInputShape ? inputInfo.shape[1] : null;
    if (!inputSize || inputSize < 1) {
      throw new TfliteSegmentationError(
        `Unexpected model input shape: [${inputInfo?.shape?.join(',') ?? 'unknown'}] ` +
          '(expected [batch, size, size, 3] or [batch, size, size, 4]).'
      );
    }

    let outputs: ArrayBuffer[];
    let inputTensor: Float32Array;
    try {
      inputTensor = buildSegmenterInputTensor(
        pixels,
        imageWidth,
        imageHeight,
        inputSize,
        inputChannels as 3 | 4
      );
      if (__DEV__) {
        // H1 check: input normalization. RGB in [0,1] should show
        // min>=0, max<=1, mean roughly in [0.1, 0.9] for a typical photo.
        // A near-constant 0/near-zero tensor here would point at a decode
        // or resize bug upstream, not the model contract.
        const s = statsOf(inputTensor, 1000);
        console.log(
          `[tflite][diag] input tensor stats (first ${s.n}/${inputTensor.length}): ` +
            `min=${s.min.toFixed(4)} max=${s.max.toFixed(4)} mean=${s.mean.toFixed(4)} ` +
            `byteLength=${inputTensor.buffer.byteLength} expectedBytes=${inputTensor.length * 4}`
        );
      }
      outputs = await model.run([inputTensor.buffer as ArrayBuffer]);
    } catch (e) {
      throw new TfliteSegmentationError('Hair segmentation inference failed.', e);
    }

    if (!outputs || outputs.length === 0) {
      throw new TfliteSegmentationError('Model produced no output tensors.');
    }

    const outputInfo = model.outputs[0];
    const outShape = outputInfo?.shape;
    const outHeight = outShape?.[1] ?? inputSize;
    const outWidth = outShape?.[2] ?? inputSize;
    const outChannels = outShape?.[3] ?? 6;

    const outputData = new Float32Array(outputs[0]);
    const expectedLength = outWidth * outHeight * outChannels;
    if (outputData.length < expectedLength) {
      throw new TfliteSegmentationError(
        `Output tensor too small: got ${outputData.length} values, expected ${expectedLength}.`
      );
    }

    if (__DEV__) {
      // H2 check: output activation. Per-channel mean tells us whether any
      // channel looks like a sane logit/probability range at all. The
      // decisive check is the per-pixel cross-channel sum on a handful of
      // sample pixels: sum ~= 1.0 everywhere => graph already ends in
      // softmax (MODEL_OUTPUTS_ARE_PROBABILITIES should be true, not
      // false); sum wildly not 1.0 (e.g. large/negative logits) => raw
      // logits, current `false` setting is correct.
      const pixelCount = outWidth * outHeight;
      const channelMeans: number[] = [];
      for (let c = 0; c < outChannels; c++) {
        let sum = 0;
        for (let i = 0; i < pixelCount; i++) {
          sum += outputData[i * outChannels + c];
        }
        channelMeans.push(sum / pixelCount);
      }
      console.log(
        `[tflite][diag] output per-channel means (${outChannels} channels): ` +
          channelMeans.map((m, c) => `ch${c}=${m.toFixed(4)}`).join(' ')
      );
      const sampleIdxs = [
        0,
        Math.floor(pixelCount / 4),
        Math.floor(pixelCount / 2),
        Math.floor((pixelCount * 3) / 4),
        pixelCount - 1,
      ];
      const sums = sampleIdxs.map((i) => {
        const base = i * outChannels;
        let sum = 0;
        for (let c = 0; c < outChannels; c++) sum += outputData[base + c];
        return sum;
      });
      console.log(
        `[tflite][diag] per-pixel cross-channel sum on ${sampleIdxs.length} sample pixels ` +
          `(≈1.0 everywhere => already softmaxed => H2 confirmed): ` +
          sums.map((s) => s.toFixed(4)).join(', ')
      );
    }

    const hair = tensorToHairMask(
      outputData,
      outWidth,
      outHeight,
      outChannels,
      MODEL_HAIR_CHANNEL,
      MODEL_OUTPUTS_ARE_PROBABILITIES
    );
    const face = tensorToHairMask(
      outputData,
      outWidth,
      outHeight,
      outChannels,
      MODEL_FACE_CHANNEL,
      MODEL_OUTPUTS_ARE_PROBABILITIES
    );

    if (__DEV__) {
      const s = statsOf(hair.data);
      let above = 0;
      for (let i = 0; i < hair.data.length; i++) {
        if (hair.data[i] > 0.5) above++;
      }
      console.log(
        `[tflite][diag] final mask stats: min=${s.min.toFixed(4)} max=${s.max.toFixed(4)} ` +
          `mean=${s.mean.toFixed(4)} fraction>0.5=${(above / hair.data.length).toFixed(4)}`
      );
    }

    return { hair, face };
  }

  /**
   * Backward-compatible `HairSegmenter` entry point: every existing call
   * site (recolor pipeline, fallback selection) only needs the hair mask.
   * Delegates to `segmentBoth` (single inference pass either way).
   */
  async segment(
    imageWidth: number,
    imageHeight: number,
    pixels: Uint8Array | null
  ): Promise<HairMask> {
    const { hair } = await this.segmentBoth(imageWidth, imageHeight, pixels);
    return hair;
  }
}

/** Exported for tests/diagnostics only; not part of the public segmenter API. */
export const __TFLITE_DEFAULT_INPUT_SIZE = TFLITE_INPUT_SIZE;
