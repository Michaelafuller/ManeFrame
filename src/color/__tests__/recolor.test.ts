import { recolorPixel, mix, computeMaxLift } from '../recolor';
import { srgbToLab } from '../lab';
import { loadColors } from '../../catalog';

const colors = loadColors();
function findColor(id: string) {
  const found = colors.find((c) => c.id === id);
  if (!found) throw new Error(`seed color "${id}" not found`);
  return found;
}

describe('mix', () => {
  it('returns a when t=0, b when t=1, and interpolates linearly', () => {
    expect(mix(10, 20, 0)).toBe(10);
    expect(mix(10, 20, 1)).toBe(20);
    expect(mix(10, 20, 0.5)).toBe(15);
  });
});

describe('computeMaxLift', () => {
  it('is 12 at opacity 1 and 22 at opacity 0', () => {
    expect(computeMaxLift(1)).toBeCloseTo(12);
    expect(computeMaxLift(0)).toBeCloseTo(22);
  });
});

describe('recolorPixel', () => {
  const pastelPink = findColor('fashion-pastel-pink'); // targetLab.l 80, opacity 0.45
  const blueBlack = findColor('fashion-blue-black'); // targetLab.l 8, opacity 0.9

  it('limits lightening on a very dark pixel to at most the lift limit', () => {
    const veryDark = { r: 26, g: 26, b: 26 }; // origLab.l ~ 9.26
    const origL = srgbToLab(veryDark).l;
    const maxLift = computeMaxLift(pastelPink.opacity);

    const result = recolorPixel(
      veryDark,
      { color: pastelPink, intensity: 1 },
      1
    );
    const resultL = srgbToLab(result).l;

    // The pre-final-blend target L is capped at origL + maxLift, and the
    // final blend only moves further toward the (even darker) original, so
    // the result can never exceed that cap.
    expect(resultL).toBeLessThanOrEqual(origL + maxLift + 0.5);
    // And it stays far below the pastel's own target L (80).
    expect(pastelPink.targetLab.l - resultL).toBeGreaterThan(40);
  });

  it('lands near the target on a light-blonde pixel', () => {
    const lightBlonde = { r: 200, g: 180, b: 150 }; // origLab.l ~ 74.27
    const result = recolorPixel(
      lightBlonde,
      { color: pastelPink, intensity: 1 },
      1
    );
    const resultL = srgbToLab(result).l;
    expect(Math.abs(pastelPink.targetLab.l - resultL)).toBeLessThan(10);
  });

  it('is monotonic: brighter input yields brighter output for the same shade', () => {
    const ash = findColor('level-8-ash');
    const grays = [10, 60, 110, 160, 210, 250].map((v) => ({
      r: v,
      g: v,
      b: v,
    }));
    const outputLs = grays.map(
      (g) => srgbToLab(recolorPixel(g, { color: ash, intensity: 1 }, 1)).l
    );
    for (let i = 1; i < outputLs.length; i++) {
      expect(outputLs[i]).toBeGreaterThan(outputLs[i - 1]);
    }
  });

  it('returns the original pixel exactly when confidence is 0', () => {
    const original = { r: 26, g: 26, b: 26 };
    const result = recolorPixel(
      original,
      { color: pastelPink, intensity: 1 },
      0
    );
    expect(result).toEqual(original);
  });

  it('returns the original pixel exactly when intensity is 0', () => {
    const original = { r: 26, g: 26, b: 26 };
    const result = recolorPixel(
      original,
      { color: pastelPink, intensity: 0 },
      1
    );
    expect(result).toEqual(original);
  });

  it('darkening has no lift limit: black dye over blonde reaches near the target L', () => {
    const blondeGrey = { r: 200, g: 200, b: 200 }; // origLab.l ~ 80.6
    const origL = srgbToLab(blondeGrey).l;
    const result = recolorPixel(
      blondeGrey,
      { color: blueBlack, intensity: 1 },
      1
    );
    const resultL = srgbToLab(result).l;

    expect(resultL).toBeLessThan(origL - 40); // darkened substantially
    expect(Math.abs(resultL - blueBlack.targetLab.l)).toBeLessThan(20); // close to target
  });
});
