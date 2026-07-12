import { blurMask, computeCutout, sampleMaskBilinear } from '../extractCutout';
import type { HairMask } from '../../segmentation/types';

function maskOf(width: number, height: number, fill = 0): HairMask {
  return { width, height, data: new Float32Array(width * height).fill(fill) };
}

function setRect(mask: HairMask, x0: number, y0: number, x1: number, y1: number, value = 1) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      mask.data[y * mask.width + x] = value;
    }
  }
}

/** Solid mid-gray donor image so RGB copy-through is easy to assert. */
function donorPixels(width: number, height: number): Uint8Array {
  const px = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    px[i * 4] = 120;
    px[i * 4 + 1] = 90;
    px[i * 4 + 2] = 60;
    px[i * 4 + 3] = 255;
  }
  return px;
}

describe('blurMask', () => {
  it('radius 0 returns an identical copy (not the same array)', () => {
    const mask = maskOf(4, 4);
    mask.data[5] = 1;
    const out = blurMask(mask, 0);
    expect(out.data).not.toBe(mask.data);
    expect(Array.from(out.data)).toEqual(Array.from(mask.data));
  });

  it('spreads an impulse into its neighborhood', () => {
    const mask = maskOf(5, 5);
    mask.data[2 * 5 + 2] = 1;
    const out = blurMask(mask, 1);
    // Center keeps the peak; direct neighbors get a share; far corners none.
    expect(out.data[2 * 5 + 2]).toBeCloseTo(1 / 9, 5);
    expect(out.data[1 * 5 + 2]).toBeCloseTo(1 / 9, 5);
    expect(out.data[0]).toBe(0);
  });

  it('preserves a uniform mask exactly (shrunken edge windows introduce no bias)', () => {
    const mask = maskOf(6, 3, 0.75);
    const out = blurMask(mask, 2);
    for (const v of out.data) expect(v).toBeCloseTo(0.75, 6);
  });
});

describe('sampleMaskBilinear', () => {
  it('returns exact cell values at cell centers', () => {
    const mask = maskOf(2, 2);
    mask.data[0] = 0.2;
    mask.data[1] = 0.4;
    mask.data[2] = 0.6;
    mask.data[3] = 0.8;
    expect(sampleMaskBilinear(mask, 0.25, 0.25)).toBeCloseTo(0.2, 6);
    expect(sampleMaskBilinear(mask, 0.75, 0.75)).toBeCloseTo(0.8, 6);
  });

  it('interpolates midway between cells and clamps outside the range', () => {
    const mask = maskOf(2, 1);
    mask.data[0] = 0;
    mask.data[1] = 1;
    expect(sampleMaskBilinear(mask, 0.5, 0.5)).toBeCloseTo(0.5, 6);
    expect(sampleMaskBilinear(mask, -1, 0.5)).toBeCloseTo(0, 6);
    expect(sampleMaskBilinear(mask, 2, 0.5)).toBeCloseTo(1, 6);
  });
});

describe('computeCutout', () => {
  const W = 40;
  const H = 40;

  it('crops to the union of hair bbox and face box, records the anchor in cutout coords', () => {
    // Hair band across the top: donor rows 4..11, cols 8..31.
    const hair = maskOf(W, H);
    setRect(hair, 8, 4, 31, 11);
    // Face below the hair: rows 12..27, cols 12..27.
    const face = maskOf(W, H);
    setRect(face, 12, 12, 27, 27);

    const result = computeCutout(donorPixels(W, H), W, H, hair, face, {
      featherRadius: 0,
      marginFraction: 0,
    });
    expect(result).not.toBeNull();
    const cut = result!;

    // Crop box = hair bbox UNION face box: cols 8..31, rows 4..27.
    expect(cut.width).toBe(24);
    expect(cut.height).toBe(24);

    // Face box sits inside the cutout canvas, in normalized coords.
    expect(cut.faceBox.x).toBeGreaterThanOrEqual(0);
    expect(cut.faceBox.y).toBeGreaterThanOrEqual(0);
    expect(cut.faceBox.x + cut.faceBox.w).toBeLessThanOrEqual(1.000001);
    expect(cut.faceBox.y + cut.faceBox.h).toBeLessThanOrEqual(1.000001);
    // Face starts at donor row 12 -> cutout row 8 of 24.
    expect(cut.faceBox.y).toBeCloseTo(8 / 24, 2);

    // RGB copied through from the donor; alpha follows the hair mask.
    const topLeftHair = ((4 - 4) * 24 + (8 - 8)) * 4; // donor (8,4) -> cutout (0,0)
    expect(cut.pixels[topLeftHair]).toBe(120);
    expect(cut.pixels[topLeftHair + 3]).toBe(255);
    // A pixel in the face region (no hair there): fully transparent.
    const faceCenterIdx = ((20 - 4) * 24 + (20 - 8)) * 4; // donor (20,20)
    expect(cut.pixels[faceCenterIdx + 3]).toBe(0);
  });

  it('reports low face coverage for hair that stays off the face', () => {
    const hair = maskOf(W, H);
    setRect(hair, 8, 4, 31, 11);
    const face = maskOf(W, H);
    setRect(face, 12, 12, 27, 27);
    const cut = computeCutout(donorPixels(W, H), W, H, hair, face, { featherRadius: 0 })!;
    expect(cut.hairCoverageInFaceBox).toBeLessThan(0.2);
  });

  it('reports high face coverage when hair covers the face (bad donor)', () => {
    const hair = maskOf(W, H);
    setRect(hair, 10, 10, 29, 29); // hair right on top of the face region
    const face = maskOf(W, H);
    setRect(face, 12, 12, 27, 27);
    const cut = computeCutout(donorPixels(W, H), W, H, hair, face, { featherRadius: 0 })!;
    expect(cut.hairCoverageInFaceBox).toBeGreaterThan(0.8);
  });

  it('feathering softens the cutout rim (alpha between 0 and 255 near edges)', () => {
    const hair = maskOf(W, H);
    setRect(hair, 8, 4, 31, 11);
    const face = maskOf(W, H);
    setRect(face, 12, 12, 27, 27);
    const cut = computeCutout(donorPixels(W, H), W, H, hair, face, {
      featherRadius: 2,
      marginFraction: 0.05,
    })!;
    let softCount = 0;
    for (let i = 0; i < cut.width * cut.height; i++) {
      const a = cut.pixels[i * 4 + 3];
      if (a > 0 && a < 255) softCount++;
    }
    expect(softCount).toBeGreaterThan(0);
  });

  it('returns null when there is no face above threshold', () => {
    const hair = maskOf(W, H);
    setRect(hair, 8, 4, 31, 11);
    const face = maskOf(W, H); // empty
    expect(computeCutout(donorPixels(W, H), W, H, hair, face)).toBeNull();
  });

  it('returns null when there is no hair above the crop threshold', () => {
    const hair = maskOf(W, H); // empty
    const face = maskOf(W, H);
    setRect(face, 12, 12, 27, 27);
    expect(computeCutout(donorPixels(W, H), W, H, hair, face)).toBeNull();
  });
});
