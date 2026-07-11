import { srgbToLab, labToSrgb, labToCss } from '../lab';

function expectRgbClose(
  actual: { r: number; g: number; b: number },
  expected: { r: number; g: number; b: number },
  tolerance = 2
) {
  expect(Math.abs(actual.r - expected.r)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(actual.g - expected.g)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(actual.b - expected.b)).toBeLessThanOrEqual(tolerance);
}

describe('srgbToLab / labToSrgb round trip', () => {
  const grid = [
    { r: 0, g: 0, b: 0 },
    { r: 255, g: 255, b: 255 },
    { r: 119, g: 119, b: 119 },
    { r: 255, g: 0, b: 0 },
    { r: 0, g: 255, b: 0 },
    { r: 0, g: 0, b: 255 },
    { r: 12, g: 90, b: 200 },
    { r: 210, g: 180, b: 140 },
    { r: 8, g: 8, b: 8 },
  ];

  it.each(grid)('round-trips %j within +/-2 per channel', (rgb) => {
    const roundTripped = labToSrgb(srgbToLab(rgb));
    expectRgbClose(roundTripped, rgb);
  });

  it('white maps to L ~= 100', () => {
    const lab = srgbToLab({ r: 255, g: 255, b: 255 });
    expect(lab.l).toBeGreaterThanOrEqual(98);
    expect(lab.l).toBeLessThanOrEqual(100.1);
  });

  it('black maps to L ~= 0', () => {
    const lab = srgbToLab({ r: 0, g: 0, b: 0 });
    expect(lab.l).toBeLessThanOrEqual(1);
    expect(lab.l).toBeGreaterThanOrEqual(0);
  });

  it('mid-grey (119,119,119) maps to L ~= 50 +/-2, a/b ~= 0', () => {
    const lab = srgbToLab({ r: 119, g: 119, b: 119 });
    expect(lab.l).toBeGreaterThanOrEqual(48);
    expect(lab.l).toBeLessThanOrEqual(52);
    expect(Math.abs(lab.a)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(lab.b)).toBeLessThanOrEqual(0.5);
  });

  it('greys generally have a/b ~= 0', () => {
    for (const v of [0, 32, 64, 96, 128, 160, 192, 224, 255]) {
      const lab = srgbToLab({ r: v, g: v, b: v });
      expect(Math.abs(lab.a)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(lab.b)).toBeLessThanOrEqual(0.5);
    }
  });
});

describe('labToCss', () => {
  it('renders white Lab as #ffffff', () => {
    expect(labToCss({ l: 100, a: 0, b: 0 })).toBe('#ffffff');
  });

  it('renders black Lab as #000000', () => {
    expect(labToCss({ l: 0, a: 0, b: 0 })).toBe('#000000');
  });

  it('returns a well-formed #rrggbb hex string', () => {
    const css = labToCss({ l: 47, a: 16, b: 28 });
    expect(css).toMatch(/^#[0-9a-f]{6}$/);
  });
});
