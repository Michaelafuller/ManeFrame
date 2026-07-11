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

// Lazy singleton: the model is only loaded once, on first use, and shared
// across every `TfliteHairSegmenter` instance/call.
let modelPromise: Promise<TfliteModel> | null = null;

function loadModel(): Promise<TfliteModel> {
  if (!modelPromise) {
    modelPromise = loadTensorflowModel(hairSegmenterModelAsset, []).catch((e: unknown) => {
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
