import { segmentWithFallback } from '../selectSegmenter';
import type { HairMask, HairSegmenter } from '../types';

function makeMask(tag: number): HairMask {
  return { width: 1, height: 1, data: new Float32Array([tag]) };
}

class StubSegmenter implements HairSegmenter {
  readonly name: string;
  private readonly maskTag: number;
  private readonly failWith: Error | null;

  constructor(name: string, options: { maskTag?: number; failWith?: Error } = {}) {
    this.name = name;
    this.maskTag = options.maskTag ?? 0;
    this.failWith = options.failWith ?? null;
  }

  segment(): Promise<HairMask> {
    if (this.failWith) {
      return Promise.reject(this.failWith);
    }
    return Promise.resolve(makeMask(this.maskTag));
  }
}

describe('segmentWithFallback', () => {
  it('returns the primary segmenter result and usedFallback=false when primary succeeds', async () => {
    const primary = new StubSegmenter('primary', { maskTag: 1 });
    const fallback = new StubSegmenter('fallback', { maskTag: 2 });

    const result = await segmentWithFallback(primary, fallback, 10, 10, new Uint8Array(4));

    expect(result.usedFallback).toBe(false);
    expect(result.mask.data[0]).toBe(1);
    expect(result.error).toBeUndefined();
  });

  it('falls back and reports usedFallback=true when primary throws', async () => {
    const primary = new StubSegmenter('primary', { failWith: new Error('model load failed') });
    const fallback = new StubSegmenter('fallback', { maskTag: 2 });

    const result = await segmentWithFallback(primary, fallback, 10, 10, new Uint8Array(4));

    expect(result.usedFallback).toBe(true);
    expect(result.mask.data[0]).toBe(2);
    expect(result.error).toBe('model load failed');
  });

  it('falls back when primary rejects with a non-Error value', async () => {
    const primary: HairSegmenter = {
      name: 'weird-primary',
      segment: () => Promise.reject('a plain string rejection'),
    };
    const fallback = new StubSegmenter('fallback', { maskTag: 9 });

    const result = await segmentWithFallback(primary, fallback, 5, 5, null);

    expect(result.usedFallback).toBe(true);
    expect(result.mask.data[0]).toBe(9);
    expect(result.error).toBe('a plain string rejection');
  });

  it('propagates if both primary and fallback fail', async () => {
    const primary = new StubSegmenter('primary', { failWith: new Error('primary broke') });
    const fallback = new StubSegmenter('fallback', { failWith: new Error('fallback broke too') });

    await expect(
      segmentWithFallback(primary, fallback, 10, 10, new Uint8Array(4))
    ).rejects.toThrow('fallback broke too');
  });

  it('passes width/height/pixels through to whichever segmenter actually runs', async () => {
    let seenArgs: [number, number, Uint8Array | null] | null = null;
    const primary: HairSegmenter = {
      name: 'recording-primary',
      segment: (w, h, p) => {
        seenArgs = [w, h, p];
        return Promise.resolve(makeMask(1));
      },
    };
    const fallback = new StubSegmenter('fallback');
    const pixels = new Uint8Array([1, 2, 3, 4]);

    await segmentWithFallback(primary, fallback, 42, 24, pixels);

    expect(seenArgs).toEqual([42, 24, pixels]);
  });
});
