/**
 * Real hair segmentation via Google's MediaPipe `hair_segmenter.tflite`
 * model, run on-device through `react-native-fast-tflite`.
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

import hairSegmenterModelAsset from '../../assets/models/hair_segmenter.tflite';
import { buildSegmenterInputTensor, TFLITE_INPUT_SIZE, tensorToHairMask } from './tensor';
import type { HairMask, HairSegmenter } from './types';

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
      const source = await resolveModelSource(Asset.fromModule(hairSegmenterModelAsset));
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

export class TfliteHairSegmenter implements HairSegmenter {
  readonly name = 'tflite-hair-segmenter';

  async segment(
    imageWidth: number,
    imageHeight: number,
    pixels: Uint8Array | null
  ): Promise<HairMask> {
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
    const inputSize =
      inputInfo && inputInfo.shape.length === 4 && inputInfo.shape[3] === 4
        ? inputInfo.shape[1]
        : null;
    if (!inputSize || inputSize < 1) {
      throw new TfliteSegmentationError(
        `Unexpected model input shape: [${inputInfo?.shape?.join(',') ?? 'unknown'}] ` +
          '(expected [batch, size, size, 4]).'
      );
    }

    let outputs: ArrayBuffer[];
    try {
      const inputTensor = buildSegmenterInputTensor(pixels, imageWidth, imageHeight, inputSize);
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
    const outChannels = outShape?.[3] ?? 2;

    const outputData = new Float32Array(outputs[0]);
    const expectedLength = outWidth * outHeight * outChannels;
    if (outputData.length < expectedLength) {
      throw new TfliteSegmentationError(
        `Output tensor too small: got ${outputData.length} values, expected ${expectedLength}.`
      );
    }

    return tensorToHairMask(outputData, outWidth, outHeight, outChannels);
  }
}

/** Exported for tests/diagnostics only; not part of the public segmenter API. */
export const __TFLITE_DEFAULT_INPUT_SIZE = TFLITE_INPUT_SIZE;
