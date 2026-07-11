/**
 * Starting-depth model: maps hair luminance (CIELAB L) to the 10-level
 * industry depth scale used by the catalog, and groups levels into bands.
 *
 * Pure functions, no React imports.
 */

// Anchors consistent with the seed data: natural level 1 ~= L 9,
// natural level 10 ~= L 80.
const LEVEL_1_L = 9;
const LEVEL_10_L = 80;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Estimates the 1..10 starting depth level for a given hair luminance (L),
 * via linear interpolation between the level-1 and level-10 anchors,
 * clamped to the valid range and rounded to the nearest integer level.
 */
export function estimateStartingLevel(
  labL: number
): 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 {
  const raw =
    1 + ((labL - LEVEL_1_L) * (10 - 1)) / (LEVEL_10_L - LEVEL_1_L);
  const rounded = Math.round(clamp(raw, 1, 10));
  return rounded as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
}

export type DepthGroup =
  | 'very-dark'
  | 'dark'
  | 'medium'
  | 'light'
  | 'very-light';

/**
 * Groups a 1..10 depth level into one of five bands:
 * 1-2 very-dark, 3-4 dark, 5-6 medium, 7-8 light, 9-10 very-light.
 */
export function depthGroup(level: number): DepthGroup {
  if (level <= 2) return 'very-dark';
  if (level <= 4) return 'dark';
  if (level <= 6) return 'medium';
  if (level <= 8) return 'light';
  return 'very-light';
}
