import { bilinearResize } from '../resize';

describe('bilinearResize', () => {
  it('upsamples a 2x2 single-channel image to 4x4 with known values', () => {
    // Source corners chosen so v11 = v10 + v01 - v00 (a planar surface),
    // which makes every interpolated value hand-computable as a simple
    // linear combination: value(sx, sy) = v00 + (v10-v00)*sx + (v01-v00)*sy.
    // top-left=0, top-right=10, bottom-left=20, bottom-right=30
    const src = new Float32Array([0, 10, 20, 30]);
    const dst = bilinearResize(src, 2, 2, 1, 4, 4);

    expect(dst.length).toBe(16);

    // "Align corners" sample mapping: dst index i in [0..3] maps to
    // src coordinate i/3 (since scale = (2-1)/(4-1) = 1/3).
    const expectedRow = (sy: number) => [
      10 * 0 + 20 * sy,
      10 * (1 / 3) + 20 * sy,
      10 * (2 / 3) + 20 * sy,
      10 * 1 + 20 * sy,
    ];
    const expected = [
      ...expectedRow(0),
      ...expectedRow(1 / 3),
      ...expectedRow(2 / 3),
      ...expectedRow(1),
    ];

    for (let i = 0; i < 16; i++) {
      expect(dst[i]).toBeCloseTo(expected[i], 5);
    }

    // Corners must match the source exactly.
    expect(dst[0]).toBeCloseTo(0, 6); // top-left
    expect(dst[3]).toBeCloseTo(10, 6); // top-right
    expect(dst[12]).toBeCloseTo(20, 6); // bottom-left
    expect(dst[15]).toBeCloseTo(30, 6); // bottom-right
  });

  it('resizes multi-channel data independently per channel', () => {
    // 2x2 RGB image: channel values chosen distinctly per-channel so a
    // mistake mixing channels would be caught.
    // Pixel order: (0,0) (1,0) (0,1) (1,1)
    const src = new Float32Array([
      /* (0,0) */ 0, 100, 200, /* (1,0) */ 10, 110, 210,
      /* (0,1) */ 20, 120, 220, /* (1,1) */ 30, 130, 230,
    ]);
    const dst = bilinearResize(src, 2, 2, 3, 3, 3);
    expect(dst.length).toBe(3 * 3 * 3);

    // Center pixel (dst 1,1) samples src (0.5, 0.5): average of all four
    // source pixels for each channel.
    const centerBase = (1 * 3 + 1) * 3;
    expect(dst[centerBase + 0]).toBeCloseTo((0 + 10 + 20 + 30) / 4, 5);
    expect(dst[centerBase + 1]).toBeCloseTo((100 + 110 + 120 + 130) / 4, 5);
    expect(dst[centerBase + 2]).toBeCloseTo((200 + 210 + 220 + 230) / 4, 5);

    // Top-left corner must equal the source's top-left pixel exactly.
    expect(dst[0]).toBeCloseTo(0, 6);
    expect(dst[1]).toBeCloseTo(100, 6);
    expect(dst[2]).toBeCloseTo(200, 6);
  });

  it('downsamples a larger image (basic sanity: output stays in source value range)', () => {
    const srcW = 8;
    const srcH = 8;
    const src = new Float32Array(srcW * srcH);
    for (let i = 0; i < src.length; i++) src[i] = i;

    const dst = bilinearResize(src, srcW, srcH, 1, 4, 4);
    expect(dst.length).toBe(16);
    for (const v of dst) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(63);
    }
  });

  it('handles a 1x1 destination by sampling the source center', () => {
    const src = new Float32Array([0, 10, 20, 30]);
    const dst = bilinearResize(src, 2, 2, 1, 1, 1);
    expect(dst.length).toBe(1);
    expect(dst[0]).toBeCloseTo((0 + 10 + 20 + 30) / 4, 5);
  });

  it('is a no-op-equivalent identity when dst size equals src size', () => {
    const src = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const dst = bilinearResize(src, 3, 3, 1, 3, 3);
    for (let i = 0; i < src.length; i++) {
      expect(dst[i]).toBeCloseTo(src[i], 6);
    }
  });
});
