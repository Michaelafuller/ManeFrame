import {
  computeMaskBoundingBox,
  computeHeadBox,
  computeOverlayTransform,
  computePlacementFromFaceMask,
  SCALP_HEIGHT_FRACTION,
  HEAD_WIDTH_PADDING_FRACTION,
} from '../headBox';
import type { HairMask } from '../../segmentation/types';
import type { NormalizedBox } from '../types';

function makeMask(width: number, height: number, fill: (x: number, y: number) => number): HairMask {
  const data = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      data[y * width + x] = fill(x, y);
    }
  }
  return { width, height, data };
}

describe('computeMaskBoundingBox', () => {
  it('returns null when no pixel exceeds the threshold', () => {
    const mask = makeMask(10, 10, () => 0.1);
    expect(computeMaskBoundingBox(mask)).toBeNull();
  });

  it('finds the exact bounding box of a single solid rectangle', () => {
    // 10x10 mask, a solid block from x=2..5, y=3..6 (4 wide, 4 tall).
    const mask = makeMask(10, 10, (x, y) => (x >= 2 && x <= 5 && y >= 3 && y <= 6 ? 1 : 0));
    const box = computeMaskBoundingBox(mask);
    expect(box).not.toBeNull();
    expect(box!.x).toBeCloseTo(2 / 10, 6);
    expect(box!.y).toBeCloseTo(3 / 10, 6);
    expect(box!.w).toBeCloseTo(4 / 10, 6);
    expect(box!.h).toBeCloseTo(4 / 10, 6);
  });

  it('picks the largest connected region when several disjoint blobs exist', () => {
    const mask = makeMask(20, 10, (x, y) => {
      // Small blob: 2x2 at (1,1).
      if (x >= 1 && x <= 2 && y >= 1 && y <= 2) return 1;
      // Large blob: 8x6 at (10,2).
      if (x >= 10 && x <= 17 && y >= 2 && y <= 7) return 1;
      return 0;
    });
    const box = computeMaskBoundingBox(mask);
    expect(box).not.toBeNull();
    expect(box!.x).toBeCloseTo(10 / 20, 6);
    expect(box!.w).toBeCloseTo(8 / 20, 6);
  });

  it('does not connect two blobs that only touch diagonally (4-connectivity only)', () => {
    const mask = makeMask(10, 10, (x, y) => {
      if (x === 2 && y === 2) return 1;
      if (x === 3 && y === 3) return 1; // diagonal neighbor only
      return 0;
    });
    const box = computeMaskBoundingBox(mask);
    // Largest region is a single pixel (both blobs tie at size 1); either
    // way the box must be exactly 1x1 in mask-fraction terms.
    expect(box).not.toBeNull();
    expect(box!.w).toBeCloseTo(1 / 10, 6);
    expect(box!.h).toBeCloseTo(1 / 10, 6);
  });

  it('respects the threshold parameter (values equal to threshold are excluded)', () => {
    const mask = makeMask(10, 10, () => 0.5);
    expect(computeMaskBoundingBox(mask, 0.5)).toBeNull();
    expect(computeMaskBoundingBox(mask, 0.4)).not.toBeNull();
  });

  it('handles a region touching the mask edges', () => {
    const mask = makeMask(10, 10, (x, y) => (x <= 1 || y <= 1 ? 1 : 0));
    const box = computeMaskBoundingBox(mask);
    expect(box).not.toBeNull();
    expect(box!.x).toBe(0);
    expect(box!.y).toBe(0);
  });
});

describe('computeHeadBox', () => {
  it('extends the scalp above the face box and pads the sides, for a centered face', () => {
    const faceBox: NormalizedBox = { x: 0.3, y: 0.3, w: 0.4, h: 0.3 };
    const head = computeHeadBox(faceBox);

    const expectedPad = faceBox.w * HEAD_WIDTH_PADDING_FRACTION;
    const expectedScalp = faceBox.h * SCALP_HEIGHT_FRACTION;

    expect(head.x).toBeCloseTo(faceBox.x - expectedPad, 6);
    expect(head.w).toBeCloseTo(faceBox.w + expectedPad * 2, 6);
    expect(head.y).toBeCloseTo(faceBox.y - expectedScalp, 6);
    expect(head.h).toBeCloseTo(faceBox.h + expectedScalp, 6);
  });

  it('clamps the top edge when the face box is near the top of the frame', () => {
    const faceBox: NormalizedBox = { x: 0.3, y: 0.05, w: 0.4, h: 0.3 };
    const head = computeHeadBox(faceBox);
    expect(head.y).toBe(0);
    // Height should be reduced by exactly the clamped overshoot, not just
    // clipped to a fixed value.
    const scalpExtra = faceBox.h * SCALP_HEIGHT_FRACTION;
    const overshoot = scalpExtra - faceBox.y;
    expect(head.h).toBeCloseTo(faceBox.h + faceBox.y, 6);
    expect(overshoot).toBeGreaterThan(0);
  });

  it('clamps the left/right edges for an off-center face near a side', () => {
    const faceBox: NormalizedBox = { x: 0.02, y: 0.3, w: 0.3, h: 0.3 };
    const head = computeHeadBox(faceBox);
    expect(head.x).toBe(0);
    expect(head.x + head.w).toBeLessThanOrEqual(1 + 1e-9);
  });

  it('clamps the right/bottom edges for a face box near the opposite corner', () => {
    const faceBox: NormalizedBox = { x: 0.75, y: 0.8, w: 0.24, h: 0.19 };
    const head = computeHeadBox(faceBox);
    expect(head.x + head.w).toBeLessThanOrEqual(1 + 1e-9);
    expect(head.y + head.h).toBeLessThanOrEqual(1 + 1e-9);
    expect(head.w).toBeGreaterThan(0);
    expect(head.h).toBeGreaterThan(0);
  });

  it('never produces a negative width or height', () => {
    const faceBox: NormalizedBox = { x: 0, y: 0, w: 1, h: 1 };
    const head = computeHeadBox(faceBox);
    expect(head.w).toBeGreaterThanOrEqual(0);
    expect(head.h).toBeGreaterThanOrEqual(0);
  });
});

describe('computeOverlayTransform', () => {
  it('produces identity-like scale/translate when overlay headBox already matches the target exactly', () => {
    const box: NormalizedBox = { x: 0.25, y: 0.25, w: 0.5, h: 0.5 };
    const transform = computeOverlayTransform(box, 200, 200, box, 200, 200);
    expect(transform.scaleX).toBeCloseTo(1, 6);
    expect(transform.scaleY).toBeCloseTo(1, 6);
    expect(transform.translateX).toBeCloseTo(0, 6);
    expect(transform.translateY).toBeCloseTo(0, 6);
  });

  it('scales up when the target head box is larger than the overlay headBox', () => {
    const overlayHeadBox: NormalizedBox = { x: 0.25, y: 0.25, w: 0.5, h: 0.5 }; // 200x200px of a 400x400 overlay
    const targetHeadBox: NormalizedBox = { x: 0.1, y: 0.1, w: 0.8, h: 0.8 }; // 800x800px of a 1000x1000 photo
    const transform = computeOverlayTransform(
      overlayHeadBox,
      400,
      400,
      targetHeadBox,
      1000,
      1000
    );
    // overlay headBox is 200x200px; target headBox is 800x800px -> scale 4x.
    expect(transform.scaleX).toBeCloseTo(4, 6);
    expect(transform.scaleY).toBeCloseTo(4, 6);
  });

  it('maps the overlay headBox rect exactly onto the target headBox rect (round-trip check)', () => {
    const overlayHeadBox: NormalizedBox = { x: 0.2, y: 0.1, w: 0.6, h: 0.4 };
    const overlayWidth = 512;
    const overlayHeight = 512;
    const targetHeadBox: NormalizedBox = { x: 0.15, y: 0.05, w: 0.5, h: 0.6 };
    const photoWidth = 768;
    const photoHeight = 1024;

    const transform = computeOverlayTransform(
      overlayHeadBox,
      overlayWidth,
      overlayHeight,
      targetHeadBox,
      photoWidth,
      photoHeight
    );

    // Map the overlay headBox's top-left and bottom-right corners through
    // the transform; they should land exactly on the target headBox's
    // corners in photo-pixel space.
    const overlayHeadPx = {
      x0: overlayHeadBox.x * overlayWidth,
      y0: overlayHeadBox.y * overlayHeight,
      x1: (overlayHeadBox.x + overlayHeadBox.w) * overlayWidth,
      y1: (overlayHeadBox.y + overlayHeadBox.h) * overlayHeight,
    };
    const mappedX0 = overlayHeadPx.x0 * transform.scaleX + transform.translateX;
    const mappedY0 = overlayHeadPx.y0 * transform.scaleY + transform.translateY;
    const mappedX1 = overlayHeadPx.x1 * transform.scaleX + transform.translateX;
    const mappedY1 = overlayHeadPx.y1 * transform.scaleY + transform.translateY;

    expect(mappedX0).toBeCloseTo(targetHeadBox.x * photoWidth, 6);
    expect(mappedY0).toBeCloseTo(targetHeadBox.y * photoHeight, 6);
    expect(mappedX1).toBeCloseTo((targetHeadBox.x + targetHeadBox.w) * photoWidth, 6);
    expect(mappedY1).toBeCloseTo((targetHeadBox.y + targetHeadBox.h) * photoHeight, 6);
  });

  it('falls back to scale 1 when the overlay headBox has zero width/height (guards divide-by-zero)', () => {
    const degenerate: NormalizedBox = { x: 0.5, y: 0.5, w: 0, h: 0 };
    const target: NormalizedBox = { x: 0.1, y: 0.1, w: 0.5, h: 0.5 };
    const transform = computeOverlayTransform(degenerate, 100, 100, target, 200, 200);
    expect(transform.scaleX).toBe(1);
    expect(transform.scaleY).toBe(1);
    expect(Number.isFinite(transform.translateX)).toBe(true);
    expect(Number.isFinite(transform.translateY)).toBe(true);
  });
});

describe('computePlacementFromFaceMask', () => {
  it('returns null when no face is detected', () => {
    const faceMask = makeMask(50, 50, () => 0.1);
    const overlayHeadBox: NormalizedBox = { x: 0.3, y: 0.2, w: 0.4, h: 0.3 };
    const result = computePlacementFromFaceMask(faceMask, overlayHeadBox, 400, 400, 800, 800);
    expect(result).toBeNull();
  });

  it('returns a finite, sensible transform for a plausible centered face', () => {
    const faceMask = makeMask(100, 100, (x, y) => {
      const cx = 50;
      const cy = 55;
      const dx = (x - cx) / 20;
      const dy = (y - cy) / 25;
      return dx * dx + dy * dy <= 1 ? 1 : 0;
    });
    const overlayHeadBox: NormalizedBox = { x: 0.25, y: 0.15, w: 0.5, h: 0.55 };
    const result = computePlacementFromFaceMask(
      faceMask,
      overlayHeadBox,
      512,
      512,
      768,
      1024
    );
    expect(result).not.toBeNull();
    expect(Number.isFinite(result!.scaleX)).toBe(true);
    expect(Number.isFinite(result!.scaleY)).toBe(true);
    expect(result!.scaleX).toBeGreaterThan(0);
    expect(result!.scaleY).toBeGreaterThan(0);
  });
});
