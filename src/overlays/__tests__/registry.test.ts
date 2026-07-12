import { OVERLAY_REGISTRY, getOverlayAsset, hasOverlayArt } from '../registry';

// Iteration 5R (M6 remediation): only this 1 of the 6 MVP styles shipped a
// real donor-hair cutout that passed the licensing bar (including a
// personality-rights check - the donor staged for buzz-cut turned out to
// be a named, identifiable person's official military portrait and was
// pulled before shipping) and the face-occlusion gate (< 20% donor
// face-box hair coverage) with a correctly-detected face anchor - see
// docs/ART.md for the full candidate-by-candidate record.
const EXPECTED_STYLE_IDS = ['pixie-crop'];

describe('OVERLAY_REGISTRY', () => {
  it('has exactly the Iteration 5R shipped-art style ids', () => {
    expect(Object.keys(OVERLAY_REGISTRY).sort()).toEqual([...EXPECTED_STYLE_IDS].sort());
  });

  it('every entry has a resolved module id and positive intrinsic dimensions', () => {
    for (const [id, entry] of Object.entries(OVERLAY_REGISTRY)) {
      // require()'ing an image asset resolves to a numeric id under Metro,
      // but jest's asset transform mocks it as an object - assert it's
      // defined rather than pin an environment-specific runtime type.
      expect(entry.module).toBeDefined();
      expect(entry.width).toBeGreaterThan(0);
      expect(entry.height).toBeGreaterThan(0);
      // Sanity: every id is well-formed kebab-case, matching the catalog convention.
      expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('headBox (the donor face box) is a valid normalized rect (0..1, positive size) for every entry', () => {
    for (const entry of Object.values(OVERLAY_REGISTRY)) {
      const { x, y, w, h } = entry.headBox;
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(w).toBeGreaterThan(0);
      expect(h).toBeGreaterThan(0);
      expect(x + w).toBeLessThanOrEqual(1);
      expect(y + h).toBeLessThanOrEqual(1);
    }
  });
});

describe('getOverlayAsset / hasOverlayArt', () => {
  it('returns the asset for a known style id', () => {
    expect(hasOverlayArt('pixie-crop')).toBe(true);
    expect(getOverlayAsset('pixie-crop')).not.toBeNull();
  });

  it('returns null/false for a style id with no art yet', () => {
    expect(hasOverlayArt('classic-bob')).toBe(false);
    expect(getOverlayAsset('classic-bob')).toBeNull();
  });

  it('returns null/false for a nonexistent style id', () => {
    expect(hasOverlayArt('not-a-real-style')).toBe(false);
    expect(getOverlayAsset('not-a-real-style')).toBeNull();
  });
});
