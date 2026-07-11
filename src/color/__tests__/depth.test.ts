import { estimateStartingLevel, depthGroup } from '../depth';

describe('estimateStartingLevel', () => {
  it('maps L 9 to level 1 (seed anchor)', () => {
    expect(estimateStartingLevel(9)).toBe(1);
  });

  it('maps L 80 to level 10 (seed anchor)', () => {
    expect(estimateStartingLevel(80)).toBe(10);
  });

  it('maps L 47 to level 6 (matches seed natural-6 shade)', () => {
    expect(estimateStartingLevel(47)).toBe(6);
  });

  it('clamps below the level-1 anchor', () => {
    expect(estimateStartingLevel(0)).toBe(1);
    expect(estimateStartingLevel(-20)).toBe(1);
  });

  it('clamps above the level-10 anchor', () => {
    expect(estimateStartingLevel(100)).toBe(10);
    expect(estimateStartingLevel(85)).toBe(10);
  });
});

describe('depthGroup', () => {
  it('groups 1-2 as very-dark', () => {
    expect(depthGroup(1)).toBe('very-dark');
    expect(depthGroup(2)).toBe('very-dark');
  });

  it('groups 3-4 as dark', () => {
    expect(depthGroup(3)).toBe('dark');
    expect(depthGroup(4)).toBe('dark');
  });

  it('groups 5-6 as medium', () => {
    expect(depthGroup(5)).toBe('medium');
    expect(depthGroup(6)).toBe('medium');
  });

  it('groups 7-8 as light', () => {
    expect(depthGroup(7)).toBe('light');
    expect(depthGroup(8)).toBe('light');
  });

  it('groups 9-10 as very-light', () => {
    expect(depthGroup(9)).toBe('very-light');
    expect(depthGroup(10)).toBe('very-light');
  });
});
