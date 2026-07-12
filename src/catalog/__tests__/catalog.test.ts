import {
  loadColors,
  loadHairstyles,
  validateHairColor,
  validateHairstyle,
  CatalogValidationError,
} from '../index';

describe('catalog loading', () => {
  it('loads colors without throwing and returns 40 entries', () => {
    expect(() => loadColors()).not.toThrow();
    const colors = loadColors();
    expect(colors).toHaveLength(40);
  });

  it('loads hairstyles without throwing and returns 18 entries', () => {
    expect(() => loadHairstyles()).not.toThrow();
    const hairstyles = loadHairstyles();
    expect(hairstyles).toHaveLength(18);
  });

  it('returns frozen arrays and entries', () => {
    const colors = loadColors();
    expect(Object.isFrozen(colors)).toBe(true);
    expect(Object.isFrozen(colors[0])).toBe(true);

    const hairstyles = loadHairstyles();
    expect(Object.isFrozen(hairstyles)).toBe(true);
    expect(Object.isFrozen(hairstyles[0])).toBe(true);
  });
});

describe('color id uniqueness and shape', () => {
  const colors = loadColors();

  it('has unique, kebab-case ids', () => {
    const ids = colors.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('has levels in range 1..10', () => {
    for (const c of colors) {
      expect(c.level).toBeGreaterThanOrEqual(1);
      expect(c.level).toBeLessThanOrEqual(10);
      expect(Number.isInteger(c.level)).toBe(true);
    }
  });

  it('has opacity and highlightRetention in range 0..1', () => {
    for (const c of colors) {
      expect(c.opacity).toBeGreaterThanOrEqual(0);
      expect(c.opacity).toBeLessThanOrEqual(1);
      expect(c.highlightRetention).toBeGreaterThanOrEqual(0);
      expect(c.highlightRetention).toBeLessThanOrEqual(1);
    }
  });

  it('has Lab values within gamut', () => {
    for (const c of colors) {
      expect(c.targetLab.l).toBeGreaterThanOrEqual(0);
      expect(c.targetLab.l).toBeLessThanOrEqual(100);
      expect(Math.abs(c.targetLab.a)).toBeLessThanOrEqual(60);
      expect(Math.abs(c.targetLab.b)).toBeLessThanOrEqual(60);
    }
  });
});

describe('hairstyle id uniqueness and shape', () => {
  const hairstyles = loadHairstyles();

  it('has unique, kebab-case ids', () => {
    const ids = hairstyles.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('has non-empty lengths, fringe, and textures arrays', () => {
    for (const s of hairstyles) {
      expect(s.lengths.length).toBeGreaterThan(0);
      expect(s.fringe.length).toBeGreaterThan(0);
      expect(s.textures.length).toBeGreaterThan(0);
    }
  });

  it('covers the full length, fringe, and texture space across the catalog', () => {
    const lengths = new Set(hairstyles.flatMap((s) => s.lengths));
    const fringes = new Set(hairstyles.flatMap((s) => s.fringe));
    const textures = new Set(hairstyles.flatMap((s) => s.textures));

    expect(lengths).toEqual(
      new Set(['buzzed', 'short', 'chin', 'shoulder', 'medium', 'long'])
    );
    expect(fringes).toEqual(
      new Set([
        'none',
        'blunt-bangs',
        'wispy-bangs',
        'curtain-bangs',
        'side-swept',
      ])
    );
    expect(textures).toEqual(
      new Set(['straight', 'wavy', 'curly', 'coily'])
    );
  });
});

describe('plausibility: natural family Lab L rises with level', () => {
  it('is monotonically non-decreasing when sorted by level', () => {
    const naturals = loadColors()
      .filter((c) => c.family === 'natural')
      .slice()
      .sort((a, b) => a.level - b.level);

    expect(naturals.length).toBeGreaterThan(0);
    for (let i = 1; i < naturals.length; i++) {
      expect(naturals[i].targetLab.l).toBeGreaterThanOrEqual(
        naturals[i - 1].targetLab.l
      );
    }
  });
});

describe('validator rejects bad data', () => {
  const validColor = {
    id: 'level-5-natural',
    displayName: 'Test Color',
    level: 5,
    family: 'natural',
    temperature: 'neutral',
    targetLab: { l: 40, a: 5, b: 10 },
    opacity: 0.7,
    highlightRetention: 0.3,
  };

  it('accepts a well-formed HairColor', () => {
    expect(() => validateHairColor(validColor)).not.toThrow();
  });

  it('rejects a non-kebab-case id', () => {
    expect(() =>
      validateHairColor({ ...validColor, id: 'Level_5_Natural' })
    ).toThrow(CatalogValidationError);
  });

  it('rejects an out-of-range level', () => {
    expect(() => validateHairColor({ ...validColor, level: 11 })).toThrow(
      CatalogValidationError
    );
    expect(() => validateHairColor({ ...validColor, level: 0 })).toThrow(
      CatalogValidationError
    );
  });

  it('rejects an invalid family', () => {
    expect(() =>
      validateHairColor({ ...validColor, family: 'rainbow' })
    ).toThrow(CatalogValidationError);
  });

  it('rejects opacity outside 0..1', () => {
    expect(() => validateHairColor({ ...validColor, opacity: 1.5 })).toThrow(
      CatalogValidationError
    );
    expect(() => validateHairColor({ ...validColor, opacity: -0.1 })).toThrow(
      CatalogValidationError
    );
  });

  it('rejects out-of-gamut Lab values', () => {
    expect(() =>
      validateHairColor({
        ...validColor,
        targetLab: { l: 40, a: 100, b: 10 },
      })
    ).toThrow(CatalogValidationError);
    expect(() =>
      validateHairColor({ ...validColor, targetLab: { l: 150, a: 5, b: 10 } })
    ).toThrow(CatalogValidationError);
  });

  const validStyle = {
    id: 'test-style',
    name: 'Test Style',
    assets: { front: 'assets/hairstyles/test-style/front.webp' },
    lengths: ['medium'],
    fringe: ['none'],
    textures: ['straight'],
    attributes: ['test'],
  };

  it('accepts a well-formed Hairstyle', () => {
    expect(() => validateHairstyle(validStyle)).not.toThrow();
  });

  it('rejects an empty lengths array', () => {
    expect(() => validateHairstyle({ ...validStyle, lengths: [] })).toThrow(
      CatalogValidationError
    );
  });

  it('rejects an empty fringe array', () => {
    expect(() => validateHairstyle({ ...validStyle, fringe: [] })).toThrow(
      CatalogValidationError
    );
  });

  it('rejects an invalid texture value', () => {
    expect(() =>
      validateHairstyle({ ...validStyle, textures: ['fluffy'] })
    ).toThrow(CatalogValidationError);
  });

  it('rejects a missing assets.front', () => {
    expect(() =>
      validateHairstyle({ ...validStyle, assets: {} })
    ).toThrow(CatalogValidationError);
  });

  it('accepts a valid assets.headBox', () => {
    expect(() =>
      validateHairstyle({
        ...validStyle,
        assets: { ...validStyle.assets, headBox: { x: 0.2, y: 0.1, w: 0.5, h: 0.5 } },
      })
    ).not.toThrow();
  });

  it('rejects an assets.headBox with a non-numeric field', () => {
    expect(() =>
      validateHairstyle({
        ...validStyle,
        assets: { ...validStyle.assets, headBox: { x: 0.2, y: 0.1, w: '0.5', h: 0.5 } },
      })
    ).toThrow(CatalogValidationError);
  });

  it('rejects an assets.headBox with zero/negative width or height', () => {
    expect(() =>
      validateHairstyle({
        ...validStyle,
        assets: { ...validStyle.assets, headBox: { x: 0.2, y: 0.1, w: 0, h: 0.5 } },
      })
    ).toThrow(CatalogValidationError);
  });

  it('rejects an assets.headBox that extends past the 0..1 bounds', () => {
    expect(() =>
      validateHairstyle({
        ...validStyle,
        assets: { ...validStyle.assets, headBox: { x: 0.7, y: 0.1, w: 0.5, h: 0.5 } },
      })
    ).toThrow(CatalogValidationError);
  });
});

describe('hairstyle overlay art integrity (Iteration 5R / M6 remediation)', () => {
  // Deliberately re-requires the overlay registry directly (rather than
  // importing it once at module scope) so this test file's failure
  // messages are unambiguous about which side (catalog vs registry) is
  // out of sync if they ever drift apart.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { OVERLAY_REGISTRY } = require('../../overlays/registry') as {
    OVERLAY_REGISTRY: Record<string, unknown>;
  };
  const hairstyles = loadHairstyles();
  const registryIds = Object.keys(OVERLAY_REGISTRY).sort();

  it('every hairstyle with assets.headBox has a matching overlay registry entry, and vice versa', () => {
    const catalogArtBearingIds = hairstyles
      .filter((s) => s.assets.headBox !== undefined)
      .map((s) => s.id)
      .sort();
    expect(catalogArtBearingIds).toEqual(registryIds);
  });

  // Iteration 5R ships real donor-hair cutouts for 3 of the 6 MVP styles:
  // pixie-crop (round 1) plus curly-shag / long-beach-waves (round 2's
  // bounded search under the revised occlusion gate). The remaining 3
  // ship as "Art coming soon" gaps (no assets.headBox): buzz-cut's
  // round-1 donor was an official military portrait of a named,
  // identifiable person (pulled - a personality-rights problem, not a
  // licensing one) with no anonymous CC0 replacement found in round 2;
  // no classic-bob candidate passed the face-occlusion/plausibility gate
  // in either round; and classic-lob's round-2 donor passed the machine
  // gate but was rejected on planner visual review (a thin braid tuft
  // crosses the target's face - the area-based gate can't see thin
  // face-crossing features). See docs/ART.md for the full record.
  it('has exactly 3 art-bearing styles (Iteration 5R donor-hair MVP, round 2)', () => {
    const catalogArtBearingIds = hairstyles.filter((s) => s.assets.headBox !== undefined);
    expect(catalogArtBearingIds).toHaveLength(3);
    expect(catalogArtBearingIds.map((s) => s.id).sort()).toEqual([
      'curly-shag',
      'long-beach-waves',
      'pixie-crop',
    ]);
  });

  it('every art-bearing style has a valid, in-range headBox', () => {
    for (const style of hairstyles) {
      if (!style.assets.headBox) continue;
      const { x, y, w, h } = style.assets.headBox;
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(w).toBeGreaterThan(0);
      expect(h).toBeGreaterThan(0);
      expect(x + w).toBeLessThanOrEqual(1);
      expect(y + h).toBeLessThanOrEqual(1);
    }
  });
});
