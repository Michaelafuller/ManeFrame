import { parseQuery } from '../parser';

describe('parseQuery: negation', () => {
  it('parses "no bangs" as requiresFringe: false', () => {
    expect(parseQuery('no bangs').requiresFringe).toBe(false);
  });

  it('parses "without fringe" as requiresFringe: false', () => {
    expect(parseQuery('without fringe').requiresFringe).toBe(false);
  });

  it('parses "with bangs" as requiresFringe: true', () => {
    expect(parseQuery('with bangs').requiresFringe).toBe(true);
  });

  it('parses unqualified "bangs" as requiresFringe: true', () => {
    expect(parseQuery('bangs').requiresFringe).toBe(true);
  });

  it('parses unqualified "fringe" as requiresFringe: true', () => {
    expect(parseQuery('fringe').requiresFringe).toBe(true);
  });

  it('leaves requiresFringe null when bangs/fringe are not mentioned', () => {
    expect(parseQuery('long straight hair').requiresFringe).toBeNull();
  });
});

describe('parseQuery: multi-word synonyms', () => {
  it('resolves "curtain bangs" as a specific fringe type, not attribute + generic bangs', () => {
    const result = parseQuery('curtain bangs');
    expect(result.fringe).toEqual(['curtain-bangs']);
    expect(result.requiresFringe).toBe(true);
    expect(result.attributeTerms).not.toContain('curtain');
  });

  it('resolves "blunt bangs" and "wispy bangs"', () => {
    expect(parseQuery('blunt bangs').fringe).toEqual(['blunt-bangs']);
    expect(parseQuery('wispy bangs').fringe).toEqual(['wispy-bangs']);
  });

  it('resolves "shoulder length" as the shoulder length term', () => {
    expect(parseQuery('shoulder length bob').lengths).toEqual(['shoulder']);
  });

  it('resolves "side swept" as the side-swept fringe type', () => {
    expect(parseQuery('side swept fringe').fringe).toEqual(['side-swept']);
  });
});

describe('parseQuery: color hints', () => {
  it('extracts warm + red family', () => {
    const result = parseQuery('warm red shoulder-length bob');
    expect(result.colorTemperature).toBe('warm');
    expect(result.colorFamilies).toEqual(['red']);
    expect(result.lengths).toEqual(['shoulder']);
    expect(result.attributeTerms).toContain('bob');
  });

  it('an explicit "dark" wins over the ambiguous "brown" fallback', () => {
    expect(parseQuery('dark brown').colorLevelHint).toBe('dark');
  });

  it('"brown" alone falls back to a medium hint', () => {
    expect(parseQuery('brown').colorLevelHint).toBe('medium');
  });

  it('"blonde" hints light, "black" hints dark', () => {
    expect(parseQuery('blonde').colorLevelHint).toBe('light');
    expect(parseQuery('black').colorLevelHint).toBe('dark');
  });
});

describe('parseQuery: stop-word-only query', () => {
  it('returns an empty parse for "the hair and a"', () => {
    const result = parseQuery('the hair and a');
    expect(result.lengths).toEqual([]);
    expect(result.fringe).toEqual([]);
    expect(result.requiresFringe).toBeNull();
    expect(result.textures).toEqual([]);
    expect(result.attributeTerms).toEqual([]);
    expect(result.colorFamilies).toEqual([]);
    expect(result.colorTemperature).toBeNull();
    expect(result.colorLevelHint).toBeNull();
  });
});

describe('parseQuery: empty string', () => {
  it('returns an empty parse for ""', () => {
    const result = parseQuery('');
    expect(result.lengths).toEqual([]);
    expect(result.fringe).toEqual([]);
    expect(result.requiresFringe).toBeNull();
    expect(result.textures).toEqual([]);
    expect(result.attributeTerms).toEqual([]);
    expect(result.colorFamilies).toEqual([]);
    expect(result.colorTemperature).toBeNull();
    expect(result.colorLevelHint).toBeNull();
  });
});

describe('parseQuery: leftover attribute terms', () => {
  it('keeps unrecognized meaningful tokens as attributeTerms', () => {
    const result = parseQuery('layered bob with bangs');
    expect(result.attributeTerms).toEqual(
      expect.arrayContaining(['layered', 'bob'])
    );
  });
});
