import { OVERLAY_REGISTRY, getOverlayAsset, hasOverlayArt } from '../registry';

// Iteration 5R (M6 remediation): 3 of the 6 MVP styles ship real
// donor-hair cutouts that passed the licensing bar (including a
// personality-rights check), the face-occlusion gate, AND planner visual
// review - pixie-crop from round 1, curly-shag / long-beach-waves from
// round 2's bounded search under the revised gate (inner-face < 0.15,
// whole-face < 0.5 backstop, face-box plausibility). Gaps: classic-bob
// (no gate-passing candidate in either round), buzz-cut (round 1's donor
// was a named officer's official military portrait, pulled; round 2
// found no anonymous CC0 replacement), and classic-lob (its round-2
// donor passed the machine gate at inner-face 0.0963 but was rejected on
// planner visual review - a thin braid tuft crosses the target's
// cheek/mouth; the gate measures covered AREA, not placement salience,
// so thin face-crossing features are a known false-negative mode) - see
// docs/ART.md for the full candidate-by-candidate record.
const EXPECTED_STYLE_IDS = ['pixie-crop', 'curly-shag', 'long-beach-waves'];

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
