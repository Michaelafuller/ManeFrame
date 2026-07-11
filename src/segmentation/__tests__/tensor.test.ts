import { buildSegmenterInputTensor, tensorToHairMask, TFLITE_INPUT_SIZE } from '../tensor';

describe('buildSegmenterInputTensor', () => {
  it('produces a [size, size, 4] float32 tensor with RGB normalized to 0..1 and a zeroed 4th channel', () => {
    // 2x2 RGBA source, resized up to a 2x2 target (identity resize) to
    // keep the expected values hand-computable.
    const pixels = new Uint8Array([
      255, 0, 0, 255, // (0,0) red
      0, 255, 0, 255, // (1,0) green
      0, 0, 255, 255, // (0,1) blue
      255, 255, 255, 255, // (1,1) white
    ]);

    const tensor = buildSegmenterInputTensor(pixels, 2, 2, 2);
    expect(tensor.length).toBe(2 * 2 * 4);

    // (0,0): red -> [1, 0, 0, 0]
    expect(tensor[0]).toBeCloseTo(1, 5);
    expect(tensor[1]).toBeCloseTo(0, 5);
    expect(tensor[2]).toBeCloseTo(0, 5);
    expect(tensor[3]).toBe(0); // previous-mask channel always 0

    // (1,1): white -> [1, 1, 1, 0]
    const lastBase = 3 * 4;
    expect(tensor[lastBase + 0]).toBeCloseTo(1, 5);
    expect(tensor[lastBase + 1]).toBeCloseTo(1, 5);
    expect(tensor[lastBase + 2]).toBeCloseTo(1, 5);
    expect(tensor[lastBase + 3]).toBe(0);
  });

  it('defaults to the model input size (512) when no targetSize is given', () => {
    const pixels = new Uint8Array(4 * 4).fill(128);
    const tensor = buildSegmenterInputTensor(pixels, 2, 2);
    expect(tensor.length).toBe(TFLITE_INPUT_SIZE * TFLITE_INPUT_SIZE * 4);
  });

  it('every 4th channel value is exactly 0 regardless of input size', () => {
    const pixels = new Uint8Array(3 * 3 * 4).map((_, i) => (i * 7) % 256);
    const tensor = buildSegmenterInputTensor(pixels, 3, 3, 5);
    for (let i = 0; i < 5 * 5; i++) {
      expect(tensor[i * 4 + 3]).toBe(0);
    }
  });
});

describe('tensorToHairMask', () => {
  it('treats a single-channel tensor as a direct confidence map (clamped to 0..1)', () => {
    const width = 2;
    const height = 2;
    const tensor = new Float32Array([0, 0.5, 1, 1.4]); // last value out of range
    const mask = tensorToHairMask(tensor, width, height, 1);

    expect(mask.width).toBe(2);
    expect(mask.height).toBe(2);
    expect(mask.data[0]).toBeCloseTo(0);
    expect(mask.data[1]).toBeCloseTo(0.5);
    expect(mask.data[2]).toBeCloseTo(1);
    expect(mask.data[3]).toBeCloseTo(1); // clamped down from 1.4
  });

  it('clamps negative single-channel values up to 0', () => {
    const tensor = new Float32Array([-0.3, 0.2]);
    const mask = tensorToHairMask(tensor, 2, 1, 1);
    expect(mask.data[0]).toBeCloseTo(0);
    expect(mask.data[1]).toBeCloseTo(0.2);
  });

  it('applies softmax over a 2-channel [background, hair] categorical tensor', () => {
    // Two pixels: pixel 0 strongly "hair" (logit 1 >> logit 0), pixel 1
    // strongly "background" (logit 0 >> logit 1).
    const tensor = new Float32Array([
      /* pixel0: background, hair */ 0, 5,
      /* pixel1: background, hair */ 5, 0,
    ]);
    const mask = tensorToHairMask(tensor, 2, 1, 2);

    const expectedHairProbPixel0 = Math.exp(5) / (Math.exp(0) + Math.exp(5));

    expect(mask.data[0]).toBeCloseTo(expectedHairProbPixel0, 6);
    // Pixel 1 has background >> hair, so hair probability should be small.
    expect(mask.data[1]).toBeLessThan(0.01);
    expect(mask.data[0]).toBeGreaterThan(0.99);
  });

  it('softmax over equal logits yields 0.5 (no bias toward either class)', () => {
    const tensor = new Float32Array([3, 3]); // background == hair logit
    const mask = tensorToHairMask(tensor, 1, 1, 2);
    expect(mask.data[0]).toBeCloseTo(0.5, 6);
  });

  it('is numerically stable for large logits (no NaN/Infinity from exp overflow)', () => {
    const tensor = new Float32Array([1000, 1001]);
    const mask = tensorToHairMask(tensor, 1, 1, 2);
    expect(Number.isFinite(mask.data[0])).toBe(true);
    expect(mask.data[0]).toBeGreaterThan(0.5);
    expect(mask.data[0]).toBeLessThanOrEqual(1);
  });

  it('throws for an invalid (zero) channel count', () => {
    expect(() => tensorToHairMask(new Float32Array(4), 2, 2, 0)).toThrow();
  });
});
