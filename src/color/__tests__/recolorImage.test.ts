import { recolorImage } from '../recolorImage';
import { recolorPixel } from '../recolor';
import type { HairMask } from '../../segmentation/types';
import { loadColors } from '../../catalog';

const colors = loadColors();
function findColor(id: string) {
  const found = colors.find((c) => c.id === id);
  if (!found) throw new Error(`seed color "${id}" not found`);
  return found;
}

const pastelPink = findColor('fashion-pastel-pink');

/** Builds an 8x8 RGBA buffer where pixel color depends only on x (columns),
 * and alpha varies per-pixel so the alpha-passthrough test has something to
 * verify. */
function makeTestImage(): Uint8Array {
  const width = 8;
  const height = 8;
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      // Columns 0-3 are one flat color, columns 4-7 another - both multiples
      // of 8 so 5-bit quantization is lossless for this test.
      const shade = x < 4 ? 64 : 192;
      rgba[idx] = shade;
      rgba[idx + 1] = shade;
      rgba[idx + 2] = shade;
      rgba[idx + 3] = (y * width + x) % 256; // varying alpha
    }
  }
  return rgba;
}

function uniformMask(width: number, height: number, value: number): HairMask {
  return { width, height, data: new Float32Array(width * height).fill(value) };
}

describe('recolorImage', () => {
  const width = 8;
  const height = 8;
  const rgba = makeTestImage();
  const params = { color: pastelPink, intensity: 1 };

  it('leaves the mask=0 region byte-identical to the input', () => {
    const mask = uniformMask(width, height, 0);
    const result = recolorImage(rgba, width, height, mask, params);
    expect(Array.from(result)).toEqual(Array.from(rgba));
  });

  it('produces recolorPixel-equivalent output where mask=1', () => {
    const mask = uniformMask(width, height, 1);
    const result = recolorImage(rgba, width, height, mask, params);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const expected = recolorPixel(
          { r: rgba[idx], g: rgba[idx + 1], b: rgba[idx + 2] },
          params,
          1
        );
        expect(result[idx]).toBe(expected.r);
        expect(result[idx + 1]).toBe(expected.g);
        expect(result[idx + 2]).toBe(expected.b);
      }
    }
  });

  it('never touches the alpha channel, mask=0 or mask=1', () => {
    for (const maskValue of [0, 0.5, 1]) {
      const mask = uniformMask(width, height, maskValue);
      const result = recolorImage(rgba, width, height, mask, params);
      for (let i = 0; i < rgba.length; i += 4) {
        expect(result[i + 3]).toBe(rgba[i + 3]);
      }
    }
  });

  it('samples a lower-resolution mask with nearest-neighbor lookup', () => {
    // 4x4 mask on an 8x8 image: each mask cell covers a 2x2 block. Top-left
    // quadrant of the mask (rows/cols 0-1) is 1, everything else is 0.
    const maskWidth = 4;
    const maskHeight = 4;
    const data = new Float32Array(maskWidth * maskHeight).fill(0);
    for (let my = 0; my < 2; my++) {
      for (let mx = 0; mx < 2; mx++) {
        data[my * maskWidth + mx] = 1;
      }
    }
    const mask: HairMask = { width: maskWidth, height: maskHeight, data };

    const result = recolorImage(rgba, width, height, mask, params);

    // Full-res pixels (0..3, 0..3) map to mask cell (0..1, 0..1) -> value 1
    // -> recolored. Pixels (4..7, 4..7) map to mask cells with value 0 ->
    // untouched.
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const idx = (y * width + x) * 4;
        const expected = recolorPixel(
          { r: rgba[idx], g: rgba[idx + 1], b: rgba[idx + 2] },
          params,
          1
        );
        expect(result[idx]).toBe(expected.r);
      }
    }
    for (let y = 4; y < 8; y++) {
      for (let x = 4; x < 8; x++) {
        const idx = (y * width + x) * 4;
        expect(result[idx]).toBe(rgba[idx]);
        expect(result[idx + 1]).toBe(rgba[idx + 1]);
        expect(result[idx + 2]).toBe(rgba[idx + 2]);
      }
    }
  });

  it('memo path (repeated colors) matches per-pixel recolorPixel exactly', () => {
    // A bigger image with only 4 distinct, 5-bit-aligned colors repeated
    // many times over, and a mask with some texture (not flat) so the
    // memo key's confidence component is exercised too.
    const w = 16;
    const h = 16;
    const big = new Uint8Array(w * h * 4);
    const palette = [0, 64, 128, 192];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const shade = palette[(x + y) % palette.length];
        big[idx] = shade;
        big[idx + 1] = shade;
        big[idx + 2] = shade;
        big[idx + 3] = 255;
      }
    }
    const maskData = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        // Two confidence bands, each repeated across many pixels.
        maskData[y * w + x] = x < w / 2 ? 0.5 : 1;
      }
    }
    const mask: HairMask = { width: w, height: h, data: maskData };

    const result = recolorImage(big, w, h, mask, params);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const confidence = x < w / 2 ? 0.5 : 1;
        const expected = recolorPixel(
          { r: big[idx], g: big[idx + 1], b: big[idx + 2] },
          params,
          confidence
        );
        expect(result[idx]).toBe(expected.r);
        expect(result[idx + 1]).toBe(expected.g);
        expect(result[idx + 2]).toBe(expected.b);
        expect(result[idx + 3]).toBe(255);
      }
    }
  });

  it('skips work (byte-identical copy) when confidence is below 0.01', () => {
    const mask = uniformMask(width, height, 0.005);
    const result = recolorImage(rgba, width, height, mask, params);
    expect(Array.from(result)).toEqual(Array.from(rgba));
  });
});
