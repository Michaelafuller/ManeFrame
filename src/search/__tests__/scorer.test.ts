import { parseQuery } from '../parser';
import { searchHairstyles, searchColors } from '../scorer';
import { loadColors, loadHairstyles } from '../../catalog';

const colors = loadColors();
const hairstyles = loadHairstyles();

describe('canonical query 1: "shoulder length with bangs"', () => {
  const parsed = parseQuery('shoulder length with bangs');
  const results = searchHairstyles(parsed, hairstyles);

  it('never returns a ["none"]-only style', () => {
    for (const { style } of results) {
      expect(style.fringe).not.toEqual(['none']);
    }
  });

  it('every top-scoring result has shoulder length and a real (non-none) fringe', () => {
    expect(results.length).toBeGreaterThan(0);
    const topScore = results[0].score;
    const topResults = results.filter((r) => r.score === topScore);
    for (const { style } of topResults) {
      expect(style.lengths).toContain('shoulder');
      expect(style.fringe.some((f) => f !== 'none')).toBe(true);
    }
  });
});

describe('canonical query 2: "short and curly"', () => {
  const parsed = parseQuery('short and curly');
  const results = searchHairstyles(parsed, hairstyles);

  it('parses to short length + curly texture', () => {
    expect(parsed.lengths).toEqual(['short']);
    expect(parsed.textures).toEqual(['curly']);
  });

  it('top result is literally short + curly', () => {
    expect(results.length).toBeGreaterThan(0);
    const topScore = results[0].score;
    const topResults = results.filter((r) => r.score === topScore);
    for (const { style } of topResults) {
      expect(style.lengths).toContain('short');
      expect(style.textures).toContain('curly');
    }
  });

  it('every result matches at least short length or curly texture', () => {
    for (const { style } of results) {
      const matchesLength = style.lengths.includes('short');
      const matchesTexture = style.textures.includes('curly');
      expect(matchesLength || matchesTexture).toBe(true);
    }
  });
});

describe('canonical query 3: "long straight hair without bangs"', () => {
  const parsed = parseQuery('long straight hair without bangs');
  const results = searchHairstyles(parsed, hairstyles);

  it('parses length/texture/negation correctly', () => {
    expect(parsed.lengths).toEqual(['long']);
    expect(parsed.textures).toEqual(['straight']);
    expect(parsed.requiresFringe).toBe(false);
  });

  it('every result is fringe-compatible with "no bangs" (not bangs-only)', () => {
    for (const { style } of results) {
      const bangsOnly =
        style.fringe.length > 0 &&
        style.fringe.every((f) =>
          ['blunt-bangs', 'wispy-bangs', 'curtain-bangs'].includes(f)
        );
      expect(bangsOnly).toBe(false);
    }
  });

  it('top result is long + straight', () => {
    expect(results.length).toBeGreaterThan(0);
    const top = results[0].style;
    expect(top.lengths).toContain('long');
    expect(top.textures).toContain('straight');
  });
});

describe('canonical query 4: "warm red shoulder-length bob"', () => {
  const parsed = parseQuery('warm red shoulder-length bob');
  const colorResults = searchColors(parsed, colors);
  const styleResults = searchHairstyles(parsed, hairstyles);

  it('searchColors returns only warm red-family shades', () => {
    expect(colorResults.length).toBeGreaterThan(0);
    for (const c of colorResults) {
      expect(c.family).toBe('red');
      expect(c.temperature).toBe('warm');
    }
  });

  it('style results favor shoulder + bob', () => {
    expect(styleResults.length).toBeGreaterThan(0);
    const top = styleResults[0].style;
    expect(top.lengths).toContain('shoulder');
    expect(top.attributes.some((a) => a.includes('bob'))).toBe(true);
  });
});

describe('canonical query 5: "dark brown curtain bangs"', () => {
  const parsed = parseQuery('dark brown curtain bangs');
  const colorResults = searchColors(parsed, colors);
  const styleResults = searchHairstyles(parsed, hairstyles);

  it('colors are filtered to dark levels (<= 4) and include natural/neutral browns', () => {
    expect(colorResults.length).toBeGreaterThan(0);
    for (const c of colorResults) {
      expect(c.level).toBeLessThanOrEqual(4);
    }
    expect(
      colorResults.some((c) => c.family === 'natural' && c.level <= 4)
    ).toBe(true);
  });

  it('styles include the curtain-bangs style(s)', () => {
    expect(
      styleResults.some((r) => r.style.fringe.includes('curtain-bangs'))
    ).toBe(true);
    const topScore = styleResults[0].score;
    for (const r of styleResults.filter((x) => x.score === topScore)) {
      expect(r.style.fringe).toContain('curtain-bangs');
    }
  });
});

describe('searchHairstyles: unranked fallback', () => {
  it('returns all styles unranked when the query is all stop words', () => {
    const parsed = parseQuery('the hair and a');
    const results = searchHairstyles(parsed, hairstyles);
    expect(results).toHaveLength(hairstyles.length);
    expect(results.every((r) => r.score === 0)).toBe(true);
  });

  it('returns all styles unranked for an empty query', () => {
    const parsed = parseQuery('');
    const results = searchHairstyles(parsed, hairstyles);
    expect(results).toHaveLength(hairstyles.length);
  });
});

describe('searchColors: unconstrained when hints absent', () => {
  it('returns all colors when the query has no color hints', () => {
    const parsed = parseQuery('short and curly');
    expect(searchColors(parsed, colors)).toHaveLength(colors.length);
  });
});
