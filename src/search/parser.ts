/**
 * Natural-language query parser for hairstyle + color search.
 *
 * Pure functions, no React imports. Tokenizes free text, resolves synonyms
 * (multi-word phrases before single tokens), detects bangs/fringe negation,
 * and buckets leftover meaningful tokens as free-form attribute terms.
 */

import type { Hairstyle, HairColor } from '../catalog/types';

export type LengthTerm = Hairstyle['lengths'][number];
export type FringeTerm = Hairstyle['fringe'][number];
export type TextureTerm = Hairstyle['textures'][number];

export interface ParsedQuery {
  lengths: Hairstyle['lengths']; // matched length terms
  fringe: Hairstyle['fringe']; // specific fringe types mentioned
  requiresFringe: boolean | null; // true "with bangs", false "without/no bangs", null unsaid
  textures: Hairstyle['textures'];
  attributeTerms: string[]; // leftover meaningful tokens (e.g. "bob", "layered")
  colorFamilies: HairColor['family'][]; // e.g. "red", "copper", "ash"
  colorTemperature: HairColor['temperature'] | null; // "warm"/"cool"/"neutral"
  colorLevelHint: 'dark' | 'medium' | 'light' | null; // "dark brown" -> dark
}

const STOP_WORDS = new Set([
  'hair',
  'with',
  'and',
  'a',
  'an',
  'the',
  'without',
  'no',
  'for',
  'of',
  'in',
  'on',
  'is',
  'im',
  'i',
  'want',
  'looking',
  'like',
  'style',
  'styles',
  'color',
  'colour',
  'please',
  'some',
  'to',
  'me',
  'my',
]);

const LENGTH_SYNONYMS: Record<string, LengthTerm> = {
  shoulder: 'shoulder',
  'shoulder-length': 'shoulder',
  collarbone: 'shoulder',
  lob: 'shoulder',
  chin: 'chin',
  'bob-length': 'chin',
  long: 'long',
  waist: 'long',
  short: 'short',
  cropped: 'short',
  pixie: 'short',
  'pixie-length': 'short',
  buzzed: 'buzzed',
  buzz: 'buzzed',
};

const TEXTURE_SYNONYMS: Record<string, TextureTerm> = {
  wavy: 'wavy',
  waves: 'wavy',
  beachy: 'wavy',
  curly: 'curly',
  curls: 'curly',
  coily: 'coily',
  kinky: 'coily',
  'afro-textured': 'coily',
  straight: 'straight',
  sleek: 'straight',
};

const TEMPERATURE_SYNONYMS: Record<string, HairColor['temperature']> = {
  warm: 'warm',
  golden: 'warm',
  cool: 'cool',
  ashy: 'cool',
  icy: 'cool',
};

const FAMILY_SYNONYMS: Record<string, HairColor['family']> = {
  red: 'red',
  ginger: 'red',
  auburn: 'red',
  copper: 'copper',
  orange: 'copper',
};

/** Explicit depth words always set (and override) the level hint. */
const LEVEL_HINT_EXPLICIT: Record<string, 'dark' | 'medium' | 'light'> = {
  dark: 'dark',
  medium: 'medium',
  light: 'light',
};

/** Ambiguous color-family words only set the hint if nothing more explicit won. */
const LEVEL_HINT_FALLBACK: Record<string, 'dark' | 'medium' | 'light'> = {
  blonde: 'light',
  brunette: 'medium',
  brown: 'medium',
  black: 'dark',
};

/** [firstWord, secondWord, resulting fringe type] */
const BANG_FRINGE_PHRASES: readonly [string, string, FringeTerm][] = [
  ['blunt', 'bangs', 'blunt-bangs'],
  ['wispy', 'bangs', 'wispy-bangs'],
  ['curtain', 'bangs', 'curtain-bangs'],
];

/** [firstWord, secondWord, resulting length term] */
const LENGTH_PHRASES: readonly [string, string, LengthTerm][] = [
  ['shoulder', 'length', 'shoulder'],
  ['bob', 'length', 'chin'],
  ['pixie', 'length', 'short'],
];

function tokenize(text: string): string[] {
  const cleaned = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  return cleaned.split(/\s+/).filter(Boolean);
}

export function parseQuery(text: string): ParsedQuery {
  const tokens = tokenize(text);
  const consumed = new Array<boolean>(tokens.length).fill(false);

  const lengths = new Set<LengthTerm>();
  const fringe = new Set<FringeTerm>();
  let requiresFringe: boolean | null = null;
  const textures = new Set<TextureTerm>();
  const colorFamilies = new Set<HairColor['family']>();
  let colorTemperature: HairColor['temperature'] | null = null;
  let colorLevelHint: 'dark' | 'medium' | 'light' | null = null;
  const attributeTerms: string[] = [];

  // Pass 1: multi-word synonym phrases, matched before single tokens so
  // e.g. "curtain bangs" resolves as a fringe type, not "curtain" + "bangs".
  for (let i = 0; i < tokens.length - 1; i++) {
    if (consumed[i] || consumed[i + 1]) continue;
    const a = tokens[i];
    const b = tokens[i + 1];

    if ((a === 'no' || a === 'without') && (b === 'bangs' || b === 'fringe')) {
      requiresFringe = false;
      consumed[i] = true;
      consumed[i + 1] = true;
      continue;
    }
    if (a === 'with' && (b === 'bangs' || b === 'fringe')) {
      if (requiresFringe !== false) requiresFringe = true;
      consumed[i] = true;
      consumed[i + 1] = true;
      continue;
    }

    const bangMatch = BANG_FRINGE_PHRASES.find(([x, y]) => x === a && y === b);
    if (bangMatch) {
      fringe.add(bangMatch[2]);
      if (requiresFringe !== false) requiresFringe = true;
      consumed[i] = true;
      consumed[i + 1] = true;
      continue;
    }

    if (a === 'side' && b === 'swept') {
      fringe.add('side-swept');
      if (requiresFringe !== false) requiresFringe = true;
      consumed[i] = true;
      consumed[i + 1] = true;
      continue;
    }

    const lengthMatch = LENGTH_PHRASES.find(([x, y]) => x === a && y === b);
    if (lengthMatch) {
      lengths.add(lengthMatch[2]);
      consumed[i] = true;
      consumed[i + 1] = true;
      continue;
    }

    if (a === 'afro' && b === 'textured') {
      textures.add('coily');
      consumed[i] = true;
      consumed[i + 1] = true;
      continue;
    }
  }

  // Pass 2: single-token synonyms + stop words + leftover attribute terms.
  for (let i = 0; i < tokens.length; i++) {
    if (consumed[i]) continue;
    const t = tokens[i];

    if (t === 'bangs' || t === 'fringe') {
      if (requiresFringe !== false) requiresFringe = true;
      continue;
    }

    // "medium" is ambiguous between hairstyle length and color depth; treat
    // it as both since the two searches are independent.
    if (t === 'medium') {
      lengths.add('medium');
      colorLevelHint = 'medium';
      continue;
    }

    if (t in LENGTH_SYNONYMS) {
      lengths.add(LENGTH_SYNONYMS[t]);
      continue;
    }
    if (t in TEXTURE_SYNONYMS) {
      textures.add(TEXTURE_SYNONYMS[t]);
      continue;
    }
    if (t in TEMPERATURE_SYNONYMS) {
      colorTemperature = TEMPERATURE_SYNONYMS[t];
      continue;
    }
    if (t in FAMILY_SYNONYMS) {
      colorFamilies.add(FAMILY_SYNONYMS[t]);
      continue;
    }
    if (t in LEVEL_HINT_EXPLICIT) {
      colorLevelHint = LEVEL_HINT_EXPLICIT[t];
      continue;
    }
    if (t in LEVEL_HINT_FALLBACK) {
      if (colorLevelHint === null) colorLevelHint = LEVEL_HINT_FALLBACK[t];
      continue;
    }
    if (STOP_WORDS.has(t)) {
      continue;
    }

    attributeTerms.push(t);
  }

  return {
    lengths: Array.from(lengths),
    fringe: Array.from(fringe),
    requiresFringe,
    textures: Array.from(textures),
    attributeTerms,
    colorFamilies: Array.from(colorFamilies),
    colorTemperature,
    colorLevelHint,
  };
}
