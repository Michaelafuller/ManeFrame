import {
  computeUniformOverlayTransform,
  computeUniformPlacementFromFaceMask,
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

describe('computeUniformOverlayTransform (Iteration 5R placement contract)', () => {
  it('is the identity when overlay and photo share the same space and face box', () => {
    const face: NormalizedBox = { x: 0.3, y: 0.2, w: 0.4, h: 0.5 };
    const t = computeUniformOverlayTransform(face, face, 100, 100, 100, 100);
    expect(t.scaleX).toBeCloseTo(1, 6);
    expect(t.scaleY).toBeCloseTo(1, 6);
    expect(t.translateX).toBeCloseTo(0, 6);
    expect(t.translateY).toBeCloseTo(0, 6);
  });

  it('always produces a uniform scale (scaleX === scaleY), even under aspect mismatch', () => {
    // Donor face box is tall+narrow, target face box is short+wide - the
    // rejected Iteration 5 non-uniform path would stretch here; 5R must not.
    const overlayFace: NormalizedBox = { x: 0.25, y: 0.3, w: 0.2, h: 0.6 };
    const targetFace: NormalizedBox = { x: 0.4, y: 0.5, w: 0.3, h: 0.2 };
    const t = computeUniformOverlayTransform(overlayFace, targetFace, 640, 480, 200, 300);
    expect(t.scaleX).toBe(t.scaleY);
  });

  it('scales by the face-box WIDTH ratio only (height plays no part)', () => {
    // Overlay 200x300px, donor face 40px wide (0.2*200). Target face 120px
    // wide (0.3*400) -> scale must be 3, regardless of the two heights.
    const overlayFace: NormalizedBox = { x: 0.25, y: 0.3, w: 0.2, h: 0.6 };
    const targetFace: NormalizedBox = { x: 0.25, y: 0.25, w: 0.3, h: 0.1 };
    const t = computeUniformOverlayTransform(overlayFace, targetFace, 400, 800, 200, 300);
    expect(t.scaleX).toBeCloseTo(3, 6);
    expect(t.scaleY).toBeCloseTo(3, 6);
  });

  it('aligns the two face boxes\' top-centers', () => {
    const overlayFace: NormalizedBox = { x: 0.1, y: 0.4, w: 0.5, h: 0.5 };
    const overlayW = 200;
    const overlayH = 400;
    const targetFace: NormalizedBox = { x: 0.5, y: 0.25, w: 0.25, h: 0.5 };
    const photoW = 800;
    const photoH = 600;
    const t = computeUniformOverlayTransform(
      overlayFace,
      targetFace,
      photoW,
      photoH,
      overlayW,
      overlayH
    );

    // Donor face top-center in overlay px: x = (0.1 + 0.25)*200 = 70, y = 160.
    const mappedX = 70 * t.scaleX + t.translateX;
    const mappedY = 160 * t.scaleY + t.translateY;
    // Target face top-center in photo px: x = (0.5 + 0.125)*800 = 500, y = 150.
    expect(mappedX).toBeCloseTo(500, 4);
    expect(mappedY).toBeCloseTo(150, 4);
  });

  it('falls back to scale 1 when the overlay face box has zero width', () => {
    const overlayFace: NormalizedBox = { x: 0.5, y: 0.5, w: 0, h: 0.2 };
    const targetFace: NormalizedBox = { x: 0.4, y: 0.4, w: 0.2, h: 0.2 };
    const t = computeUniformOverlayTransform(overlayFace, targetFace, 100, 100, 50, 50);
    expect(t.scaleX).toBe(1);
    expect(t.scaleY).toBe(1);
  });
});

describe('computeUniformPlacementFromFaceMask', () => {
  it('returns null when the face mask has nothing above threshold', () => {
    const empty = makeMask(16, 16, () => 0);
    const overlayFace: NormalizedBox = { x: 0.25, y: 0.25, w: 0.5, h: 0.5 };
    expect(
      computeUniformPlacementFromFaceMask(empty, overlayFace, 100, 100, 640, 480)
    ).toBeNull();
  });

  it('produces the same transform as calling the two steps manually', () => {
    // Face blob: x 4..11, y 6..13 on a 16x16 mask.
    const mask = makeMask(16, 16, (x, y) => (x >= 4 && x <= 11 && y >= 6 && y <= 13 ? 1 : 0));
    const overlayFace: NormalizedBox = { x: 0.2, y: 0.1, w: 0.6, h: 0.5 };
    const t = computeUniformPlacementFromFaceMask(mask, overlayFace, 300, 200, 640, 480);
    expect(t).not.toBeNull();

    // Detected target face box: x=4/16, y=6/16, w=8/16, h=8/16.
    const targetFacePxW = (8 / 16) * 640;
    const overlayFacePxW = 0.6 * 300;
    expect(t!.scaleX).toBeCloseTo(targetFacePxW / overlayFacePxW, 6);
    expect(t!.scaleY).toBe(t!.scaleX);

    // Top-center alignment: donor face top-center (0.5*300, 0.1*200).
    const mappedX = 0.5 * 300 * t!.scaleX + t!.translateX;
    const mappedY = 0.1 * 200 * t!.scaleY + t!.translateY;
    expect(mappedX).toBeCloseTo(((4 + 4) / 16) * 640, 4); // face box center x
    expect(mappedY).toBeCloseTo((6 / 16) * 480, 4); // face box top y
  });
});
