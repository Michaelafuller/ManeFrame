import { OVERLAY_REGISTRY, getOverlayAsset, hasOverlayArt } from '../registry';
import { OVERLAY_HEAD_BOX, OVERLAY_HEIGHT, OVERLAY_WIDTH } from '../svg/shared';

const EXPECTED_STYLE_IDS = [
  'pixie-crop',
  'buzz-cut',
  'classic-bob',
  'classic-lob',
  'long-beach-waves',
  'curly-shag',
];

describe('OVERLAY_REGISTRY', () => {
  it('has exactly the six MVP art-bearing style ids', () => {
    expect(Object.keys(OVERLAY_REGISTRY).sort()).toEqual([...EXPECTED_STYLE_IDS].sort());
  });

  it('every entry has non-empty SVG markup with a matching viewBox', () => {
    for (const [id, entry] of Object.entries(OVERLAY_REGISTRY)) {
      expect(entry.svg).toContain('<svg');
      expect(entry.svg).toContain(`viewBox="0 0 ${OVERLAY_WIDTH} ${OVERLAY_HEIGHT}"`);
      expect(entry.svg.length).toBeGreaterThan(100);
      expect(entry.width).toBe(OVERLAY_WIDTH);
      expect(entry.height).toBe(OVERLAY_HEIGHT);
      expect(entry.headBox).toEqual(OVERLAY_HEAD_BOX);
      // Sanity: every id is well-formed kebab-case, matching the catalog convention.
      expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('every SVG is well-formed enough to be closed (naive tag balance check)', () => {
    for (const entry of Object.values(OVERLAY_REGISTRY)) {
      const opens = (entry.svg.match(/<svg[\s>]/g) ?? []).length;
      const closes = (entry.svg.match(/<\/svg>/g) ?? []).length;
      expect(opens).toBe(1);
      expect(closes).toBe(1);
    }
  });

  it('headBox is a valid normalized rect (0..1, positive size) for every entry', () => {
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
    expect(hasOverlayArt('classic-bob')).toBe(true);
    expect(getOverlayAsset('classic-bob')).not.toBeNull();
  });

  it('returns null/false for a style id with no art yet', () => {
    expect(hasOverlayArt('coily-afro')).toBe(false);
    expect(getOverlayAsset('coily-afro')).toBeNull();
  });

  it('returns null/false for a nonexistent style id', () => {
    expect(hasOverlayArt('not-a-real-style')).toBe(false);
    expect(getOverlayAsset('not-a-real-style')).toBeNull();
  });
});
