/**
 * Scores and filters the seed catalogs against a parsed query.
 *
 * Pure functions, no React imports.
 */

import type { Hairstyle, HairColor } from '../catalog/types';
import type { ParsedQuery, FringeTerm } from './parser';

export interface ScoredHairstyle {
  style: Hairstyle;
  score: number;
}

const BANG_FRINGE_TYPES: readonly FringeTerm[] = [
  'blunt-bangs',
  'wispy-bangs',
  'curtain-bangs',
];

function isEmptyQuery(query: ParsedQuery): boolean {
  return (
    query.lengths.length === 0 &&
    query.fringe.length === 0 &&
    query.requiresFringe === null &&
    query.textures.length === 0 &&
    query.attributeTerms.length === 0 &&
    query.colorFamilies.length === 0 &&
    query.colorTemperature === null &&
    query.colorLevelHint === null
  );
}

function isNoneOnlyFringe(style: Hairstyle): boolean {
  return style.fringe.length === 1 && style.fringe[0] === 'none';
}

function isBangsOnlyFringe(style: Hairstyle): boolean {
  return (
    style.fringe.length > 0 &&
    style.fringe.every((f) => (BANG_FRINGE_TYPES as string[]).includes(f))
  );
}

/**
 * Scores and ranks hairstyles against a parsed query.
 * score = lengthMatch*5 + fringeMatch*4 + textureMatch*3 + attributeMatches*1
 *
 * Styles whose fringe is exactly ["none"] are excluded when
 * `requiresFringe === true`; styles whose fringe options are only bang
 * variants are excluded when `requiresFringe === false`. Zero-score results
 * are omitted. If the query parses to nothing (all stop words / empty
 * string), all styles are returned unranked (score 0, catalog order).
 */
export function searchHairstyles(
  query: ParsedQuery,
  styles: Hairstyle[]
): ScoredHairstyle[] {
  if (isEmptyQuery(query)) {
    return styles.map((style) => ({ style, score: 0 }));
  }

  const results: ScoredHairstyle[] = [];

  for (const style of styles) {
    if (query.requiresFringe === true && isNoneOnlyFringe(style)) continue;
    if (query.requiresFringe === false && isBangsOnlyFringe(style)) continue;

    const lengthMatch =
      query.lengths.length > 0 &&
      style.lengths.some((l) => (query.lengths as string[]).includes(l))
        ? 1
        : 0;

    let fringeMatch = 0;
    if (query.fringe.length > 0) {
      fringeMatch = style.fringe.some((f) =>
        (query.fringe as string[]).includes(f)
      )
        ? 1
        : 0;
    } else if (query.requiresFringe === true) {
      fringeMatch = style.fringe.some((f) => f !== 'none') ? 1 : 0;
    } else if (query.requiresFringe === false) {
      fringeMatch = style.fringe.includes('none') ? 1 : 0;
    }

    const textureMatch =
      query.textures.length > 0 &&
      style.textures.some((t) => (query.textures as string[]).includes(t))
        ? 1
        : 0;

    const attributeMatches = query.attributeTerms.filter((term) =>
      style.attributes.some(
        (a) => a === term || a.includes(term) || term.includes(a)
      )
    ).length;

    const score =
      lengthMatch * 5 +
      fringeMatch * 4 +
      textureMatch * 3 +
      attributeMatches * 1;

    if (score > 0) {
      results.push({ style, score });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

/**
 * Filters colors by family / temperature / depth-level hint. Any of the
 * three that's absent from the query is unconstrained.
 * dark -> level <= 4, medium -> 5..7, light -> level >= 8.
 */
export function searchColors(
  query: ParsedQuery,
  colors: HairColor[]
): HairColor[] {
  return colors.filter((color) => {
    if (
      query.colorFamilies.length > 0 &&
      !(query.colorFamilies as string[]).includes(color.family)
    ) {
      return false;
    }
    if (
      query.colorTemperature !== null &&
      color.temperature !== query.colorTemperature
    ) {
      return false;
    }
    if (query.colorLevelHint === 'dark' && color.level > 4) return false;
    if (
      query.colorLevelHint === 'medium' &&
      (color.level < 5 || color.level > 7)
    ) {
      return false;
    }
    if (query.colorLevelHint === 'light' && color.level < 8) return false;

    return true;
  });
}
