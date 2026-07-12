import { MockHairSegmenter } from '../mock';

describe('MockHairSegmenter', () => {
  const segmenter = new MockHairSegmenter();

  it('caps the mask at 256px on the long side, preserving aspect ratio', async () => {
    const mask = await segmenter.segment(1024, 768, null);
    expect(Math.max(mask.width, mask.height)).toBeLessThanOrEqual(256);
    expect(mask.width).toBe(256);
    expect(mask.height).toBe(Math.round((256 * 768) / 1024));
    // aspect ratio preserved within rounding
    expect(mask.width / mask.height).toBeCloseTo(1024 / 768, 1);
  });

  it('does not upscale an already-small image beyond 256', async () => {
    const mask = await segmenter.segment(100, 50, null);
    expect(mask.width).toBe(100);
    expect(mask.height).toBe(50);
  });

  it('handles a portrait (tall) image, capping height at 256', async () => {
    const mask = await segmenter.segment(600, 800, null);
    expect(mask.height).toBe(256);
    expect(mask.width).toBe(Math.round((256 * 600) / 800));
  });

  it('data length matches width*height', async () => {
    const mask = await segmenter.segment(300, 400, null);
    expect(mask.data.length).toBe(mask.width * mask.height);
  });

  it('all values are within 0..1', async () => {
    const mask = await segmenter.segment(300, 400, null);
    for (let i = 0; i < mask.data.length; i++) {
      expect(mask.data[i]).toBeGreaterThanOrEqual(0);
      expect(mask.data[i]).toBeLessThanOrEqual(1);
    }
  });

  it('center-top of the hair band is approximately 1', async () => {
    const mask = await segmenter.segment(300, 400, null);
    // Just above the hair-cap center, well clear of the face cutout below it.
    const x = Math.round(0.5 * mask.width);
    const y = Math.round(0.15 * mask.height);
    const value = mask.data[y * mask.width + x];
    expect(value).toBeGreaterThan(0.95);
  });

  it('image corners are approximately 0', async () => {
    const mask = await segmenter.segment(300, 400, null);
    const corners = [
      [0, 0],
      [mask.width - 1, 0],
      [0, mask.height - 1],
      [mask.width - 1, mask.height - 1],
    ];
    for (const [x, y] of corners) {
      const value = mask.data[y * mask.width + x];
      expect(value).toBeLessThan(0.05);
    }
  });

  it('face center is attenuated to <= 0.15', async () => {
    const mask = await segmenter.segment(300, 400, null);
    const x = Math.round(0.5 * mask.width);
    const y = Math.round(0.48 * mask.height);
    const value = mask.data[y * mask.width + x];
    expect(value).toBeLessThanOrEqual(0.15);
  });

  it('is symmetric about the vertical axis', async () => {
    const mask = await segmenter.segment(300, 400, null);
    for (let y = 0; y < mask.height; y += 7) {
      for (let x = 0; x < Math.floor(mask.width / 2); x += 7) {
        const mirrorX = mask.width - 1 - x;
        const left = mask.data[y * mask.width + x];
        const right = mask.data[y * mask.width + mirrorX];
        expect(left).toBeCloseTo(right, 5);
      }
    }
  });

  it('is deterministic across repeated calls', async () => {
    const a = await segmenter.segment(300, 400, null);
    const b = await segmenter.segment(300, 400, null);
    expect(Array.from(a.data)).toEqual(Array.from(b.data));
  });

  it('ignores the pixels argument entirely', async () => {
    const withPixels = await segmenter.segment(
      300,
      400,
      new Uint8Array(300 * 400 * 4).fill(255)
    );
    const withoutPixels = await segmenter.segment(300, 400, null);
    expect(Array.from(withPixels.data)).toEqual(Array.from(withoutPixels.data));
  });
});

describe('MockHairSegmenter.segmentBoth (face mask, added Iteration 5)', () => {
  const segmenter = new MockHairSegmenter();

  it('returns a hair mask identical to segment()', async () => {
    const { hair } = await segmenter.segmentBoth(300, 400, null);
    const plain = await segmenter.segment(300, 400, null);
    expect(hair.width).toBe(plain.width);
    expect(hair.height).toBe(plain.height);
    expect(Array.from(hair.data)).toEqual(Array.from(plain.data));
  });

  it('face mask is same dimensions as hair mask', async () => {
    const { hair, face } = await segmenter.segmentBoth(300, 400, null);
    expect(face.width).toBe(hair.width);
    expect(face.height).toBe(hair.height);
    expect(face.data.length).toBe(hair.data.length);
  });

  it('face mask center is near 1 (opposite of the hair mask, which is attenuated there)', async () => {
    const { face } = await segmenter.segmentBoth(300, 400, null);
    const x = Math.round(0.5 * face.width);
    const y = Math.round(0.48 * face.height);
    expect(face.data[y * face.width + x]).toBeGreaterThan(0.9);
  });

  it('face mask corners are approximately 0', async () => {
    const { face } = await segmenter.segmentBoth(300, 400, null);
    const corners = [
      [0, 0],
      [face.width - 1, 0],
      [0, face.height - 1],
      [face.width - 1, face.height - 1],
    ];
    for (const [x, y] of corners) {
      expect(face.data[y * face.width + x]).toBeLessThan(0.05);
    }
  });

  it('all face mask values are within 0..1', async () => {
    const { face } = await segmenter.segmentBoth(300, 400, null);
    for (let i = 0; i < face.data.length; i++) {
      expect(face.data[i]).toBeGreaterThanOrEqual(0);
      expect(face.data[i]).toBeLessThanOrEqual(1);
    }
  });
});
