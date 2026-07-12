import {
  blurMask,
  checkFaceBoxPlausibility,
  computeAlphaCoverage,
  computeCutout,
  computeInnerFaceBox,
  INNER_FACE_MAX_COVERAGE,
  keepLargestRegion,
  sampleMaskBilinear,
  WHOLE_FACE_MAX_COVERAGE,
} from '../extractCutout';
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

describe('keepLargestRegion', () => {
  it('keeps the largest connected blob and zeroes the rest', () => {
    const mask = maskOf(10, 10);
    setRect(mask, 1, 1, 2, 2); // 4 px island
    setRect(mask, 5, 5, 8, 8); // 16 px main region
    const out = keepLargestRegion(mask, 0.5);
    expect(out.data[1 * 10 + 1]).toBe(0); // island removed
    expect(out.data[6 * 10 + 6]).toBe(1); // main region kept, values intact
  });

  it('returns an all-zero mask when nothing exceeds the threshold', () => {
    const mask = maskOf(6, 6, 0.2);
    const out = keepLargestRegion(mask, 0.5);
    expect(Math.max(...out.data)).toBe(0);
  });

  it('cutout drops a stray island entirely (end to end)', () => {
    const W = 40;
    const H = 40;
    const hair = maskOf(W, H);
    setRect(hair, 8, 4, 31, 11); // main hair band
    setRect(hair, 2, 34, 3, 35); // stray 2x2 island far below
    const face = maskOf(W, H);
    setRect(face, 12, 12, 27, 27);
    const cut = computeCutout(donorPixels(W, H), W, H, hair, face, {
      featherRadius: 0,
      marginFraction: 0,
    })!;
    // Crop box must ignore the island: rows 4..27 only (height 24), so the
    // island rows (34..35) are outside the cutout entirely.
    expect(cut.height).toBe(24);
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

  it('reports the revised-gate fields: gatePass true and empty reasons for a clean donor', () => {
    const hair = maskOf(W, H);
    setRect(hair, 8, 4, 31, 11); // hair band, off the face entirely
    const face = maskOf(W, H);
    setRect(face, 12, 12, 27, 27);
    const cut = computeCutout(donorPixels(W, H), W, H, hair, face, { featherRadius: 0 })!;
    expect(cut.gatePass).toBe(true);
    expect(cut.gateReasons).toEqual([]);
    expect(cut.faceBoxPlausibility.plausible).toBe(true);
    expect(cut.innerFaceCoverage).toBe(0);
    expect(cut.donorWidth).toBe(W);
    expect(cut.donorHeight).toBe(H);
    // Face box here is a 16x16 square donor-side, comfortably inside the plausibility bounds.
    expect(cut.donorFaceBox.w).toBeCloseTo(16 / W, 6);
  });

  it('gatePass is false and gateReasons is populated when hair covers the inner face zone', () => {
    // Hair covers the whole face box, including its inner zone.
    const hair = maskOf(W, H);
    setRect(hair, 10, 10, 29, 29);
    const face = maskOf(W, H);
    setRect(face, 12, 12, 27, 27);
    const cut = computeCutout(donorPixels(W, H), W, H, hair, face, { featherRadius: 0 })!;
    expect(cut.gatePass).toBe(false);
    expect(cut.innerFaceCoverage).toBeGreaterThanOrEqual(INNER_FACE_MAX_COVERAGE);
    expect(cut.gateReasons.some((r) => r.includes('inner-face'))).toBe(true);
  });

  it('gatePass is false when the donor face box is implausible even though occlusion reads 0 (the "shoulder-lock" case)', () => {
    // A face box that is far too wide/short relative to its own donor image
    // (aspect and width-fraction both violate the plausibility bounds) -
    // reproduces the Iteration 5R round-1 "Model Features" bug: a
    // mis-detected face-skin region (e.g. a bare shoulder) that numerically
    // scores 0% hair coverage but is anchored to the wrong place entirely.
    const W2 = 100;
    const H2 = 100;
    const hair = maskOf(W2, H2);
    setRect(hair, 5, 5, 20, 15); // small hair patch, nowhere near the "face"
    const face = maskOf(W2, H2);
    // Wide, short "face" box occupying most of the image width - this is
    // exactly the shape a shoulder/torso mis-detection produces.
    setRect(face, 5, 60, 94, 94);
    const cut = computeCutout(donorPixels(W2, H2), W2, H2, hair, face, { featherRadius: 0 })!;
    expect(cut.hairCoverageInFaceBox).toBe(0);
    expect(cut.innerFaceCoverage).toBe(0);
    expect(cut.faceBoxPlausibility.plausible).toBe(false);
    expect(cut.gatePass).toBe(false);
    expect(cut.gateReasons.length).toBeGreaterThan(0);
  });
});

describe('computeInnerFaceBox', () => {
  it('shrinks the face box to the eyes/nose/mouth zone per the round-2 addendum fractions', () => {
    const inner = computeInnerFaceBox({ x: 0.1, y: 0.2, w: 0.5, h: 0.6 });
    expect(inner.x).toBeCloseTo(0.1 + 0.2 * 0.5, 6); // x + 0.20w
    expect(inner.y).toBeCloseTo(0.2 + 0.15 * 0.6, 6); // y + 0.15h
    expect(inner.w).toBeCloseTo(0.6 * 0.5, 6); // 0.60w
    expect(inner.h).toBeCloseTo(0.7 * 0.6, 6); // 0.70h
  });
});

describe('computeAlphaCoverage', () => {
  it('computes the fraction of covered pixels inside a normalized box', () => {
    const W = 10;
    const H = 10;
    const pixels = new Uint8Array(W * H * 4);
    // Fill the left half with alpha=255, right half alpha=0.
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        pixels[(y * W + x) * 4 + 3] = x < 5 ? 255 : 0;
      }
    }
    expect(computeAlphaCoverage(pixels, W, H, { x: 0, y: 0, w: 0.5, h: 1 })).toBeCloseTo(1, 6);
    expect(computeAlphaCoverage(pixels, W, H, { x: 0.5, y: 0, w: 0.5, h: 1 })).toBeCloseTo(0, 6);
    expect(computeAlphaCoverage(pixels, W, H, { x: 0, y: 0, w: 1, h: 1 })).toBeCloseTo(0.5, 6);
  });
});

describe('checkFaceBoxPlausibility', () => {
  it('accepts a typical portrait face box (roughly square, moderate width, upper frame)', () => {
    const result = checkFaceBoxPlausibility({ x: 0.3, y: 0.15, w: 0.35, h: 0.4 }, 1000, 1000);
    expect(result.plausible).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it('rejects an aspect ratio outside [0.55, 1.15] (too wide/short - the shoulder-lock signature)', () => {
    const result = checkFaceBoxPlausibility({ x: 0.05, y: 0.6, w: 0.9, h: 0.34 }, 1000, 1000);
    expect(result.plausible).toBe(false);
    expect(result.reasons.some((r) => r.includes('aspect'))).toBe(true);
  });

  it('rejects a width fraction below 15% of the image (subject too small/distant)', () => {
    const result = checkFaceBoxPlausibility({ x: 0.4, y: 0.3, w: 0.08, h: 0.1 }, 1000, 1000);
    expect(result.plausible).toBe(false);
    expect(result.reasons.some((r) => r.includes('width fraction'))).toBe(true);
  });

  it('rejects a width fraction above 60% of the image (extreme close-up crop) - the pixie-crop finding', () => {
    // Reproduces the round-2 on-device finding for the shipped pixie-crop
    // donor: face-box width fraction 0.621, just over the 0.60 cap.
    const result = checkFaceBoxPlausibility(
      { x: 0.3086, y: 0.2148, w: 0.6211, h: 0.7070 },
      1024,
      1024
    );
    expect(result.plausible).toBe(false);
    expect(result.reasons.some((r) => r.includes('width fraction'))).toBe(true);
  });

  it('rejects a face box whose top edge sits in the bottom third of the image', () => {
    const result = checkFaceBoxPlausibility({ x: 0.3, y: 0.75, w: 0.3, h: 0.25 }, 1000, 1000);
    expect(result.plausible).toBe(false);
    expect(result.reasons.some((r) => r.includes('bottom third'))).toBe(true);
  });

  it('accumulates multiple reasons when more than one bound is violated', () => {
    const result = checkFaceBoxPlausibility({ x: 0, y: 0.9, w: 0.9, h: 0.09 }, 1000, 1000);
    expect(result.plausible).toBe(false);
    expect(result.reasons.length).toBeGreaterThan(1);
  });
});

describe('gate threshold constants', () => {
  it('inner-face gate is stricter than the whole-face backstop', () => {
    expect(INNER_FACE_MAX_COVERAGE).toBeLessThan(WHOLE_FACE_MAX_COVERAGE);
  });
});
