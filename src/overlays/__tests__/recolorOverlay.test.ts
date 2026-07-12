import { overlayAlphaMask, recolorOverlayImage } from '../recolorOverlay';
import type { HairColor } from '../../catalog/types';

const TEAL: HairColor = {
  id: 'test-teal',
  displayName: 'Test Teal',
  level: 5,
  family: 'fashion',
  temperature: 'cool',
  targetLab: { l: 45, a: -25, b: -10 },
  opacity: 0.9,
  highlightRetention: 0.3,
};

describe('overlayAlphaMask', () => {
  it('normalizes the alpha channel to 0..1', () => {
    const pixels = new Uint8Array([
      10, 20, 30, 255, // opaque
      10, 20, 30, 0, // transparent
      10, 20, 30, 128, // half
    ]);
    const mask = overlayAlphaMask(pixels, 3, 1);
    expect(mask.data[0]).toBeCloseTo(1, 5);
    expect(mask.data[1]).toBeCloseTo(0, 5);
    expect(mask.data[2]).toBeCloseTo(128 / 255, 5);
  });

  it('produces a mask matching the given width/height', () => {
    const pixels = new Uint8Array(2 * 3 * 4);
    const mask = overlayAlphaMask(pixels, 2, 3);
    expect(mask.width).toBe(2);
    expect(mask.height).toBe(3);
    expect(mask.data.length).toBe(6);
  });
});

describe('recolorOverlayImage', () => {
  it('leaves fully-transparent pixels untouched (RGB and alpha)', async () => {
    const pixels = new Uint8Array([90, 60, 40, 0]); // brown, but alpha=0
    const result = await recolorOverlayImage(pixels, 1, 1, { color: TEAL, intensity: 1 });
    expect(result).not.toBeNull();
    expect(result![0]).toBe(90);
    expect(result![1]).toBe(60);
    expect(result![2]).toBe(40);
    expect(result![3]).toBe(0);
  });

  it('recolors fully-opaque pixels toward the target color', async () => {
    // Mid-brown, fully opaque - a plausible overlay "hair fill" pixel.
    const pixels = new Uint8Array([106, 74, 53, 255]);
    const result = await recolorOverlayImage(pixels, 1, 1, { color: TEAL, intensity: 1 });
    expect(result).not.toBeNull();
    // Teal target has negative a/b (green/blue-leaning) - the recolored
    // pixel should have shifted away from the original warm brown.
    expect(result![2]).toBeGreaterThan(pixels[2]); // more blue than original
    expect(result![3]).toBe(255); // alpha preserved exactly
  });

  it('partially recolors soft-edge (partial alpha) pixels proportionally to alpha', async () => {
    const opaque = new Uint8Array([106, 74, 53, 255]);
    const half = new Uint8Array([106, 74, 53, 128]);
    const opaqueResult = await recolorOverlayImage(opaque, 1, 1, { color: TEAL, intensity: 1 });
    const halfResult = await recolorOverlayImage(half, 1, 1, { color: TEAL, intensity: 1 });
    expect(opaqueResult).not.toBeNull();
    expect(halfResult).not.toBeNull();
    // Half-alpha pixel should shift less far toward blue than the fully
    // opaque one (less confidence => less blend amount).
    const opaqueShift = opaqueResult![2] - opaque[2];
    const halfShift = halfResult![2] - half[2];
    expect(halfShift).toBeGreaterThan(0);
    expect(halfShift).toBeLessThan(opaqueShift);
  });

  it('never modifies the alpha channel', async () => {
    const pixels = new Uint8Array([106, 74, 53, 200, 40, 30, 20, 90]);
    const result = await recolorOverlayImage(pixels, 2, 1, { color: TEAL, intensity: 0.6 });
    expect(result).not.toBeNull();
    expect(result![3]).toBe(200);
    expect(result![7]).toBe(90);
  });

  it('respects cancellation via isStale, resolving null', async () => {
    const pixels = new Uint8Array(4 * 100 * 100).fill(200);
    const result = await recolorOverlayImage(
      pixels,
      100,
      100,
      { color: TEAL, intensity: 1 },
      { chunkPixels: 10, isStale: () => true }
    );
    expect(result).toBeNull();
  });
});
