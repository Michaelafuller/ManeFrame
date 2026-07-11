import type { HairColor, Hairstyle } from './types';
import colorsData from './data/colors.json';
import hairstylesData from './data/hairstyles.json';

export * from './types';

export class CatalogValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CatalogValidationError';
  }
}

const KEBAB_CASE_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const HAIR_COLOR_FAMILIES = new Set([
  'natural',
  'ash',
  'gold',
  'copper',
  'red',
  'violet',
  'mahogany',
  'fashion',
]);

const HAIR_COLOR_TEMPERATURES = new Set(['cool', 'neutral', 'warm']);

const HAIRSTYLE_LENGTHS = new Set([
  'buzzed',
  'short',
  'chin',
  'shoulder',
  'medium',
  'long',
]);

const HAIRSTYLE_FRINGES = new Set([
  'none',
  'blunt-bangs',
  'wispy-bangs',
  'curtain-bangs',
  'side-swept',
]);

const HAIRSTYLE_TEXTURES = new Set(['straight', 'wavy', 'curly', 'coily']);

function isKebabCase(id: unknown): id is string {
  return typeof id === 'string' && KEBAB_CASE_RE.test(id);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function assertUniqueIds(ids: string[], kind: string): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      throw new CatalogValidationError(
        `Duplicate ${kind} id "${id}" found in catalog.`
      );
    }
    seen.add(id);
  }
}

/**
 * Validates a single HairColor entry, throwing CatalogValidationError with a
 * descriptive message on the first violation found.
 */
export function validateHairColor(value: unknown): HairColor {
  if (typeof value !== 'object' || value === null) {
    throw new CatalogValidationError('HairColor entry must be an object.');
  }
  const c = value as Record<string, unknown>;

  if (!isKebabCase(c.id)) {
    throw new CatalogValidationError(
      `HairColor id "${String(c.id)}" must be a non-empty kebab-case string.`
    );
  }
  if (typeof c.displayName !== 'string' || c.displayName.trim() === '') {
    throw new CatalogValidationError(
      `HairColor "${c.id}" must have a non-empty displayName.`
    );
  }
  if (
    typeof c.level !== 'number' ||
    !Number.isInteger(c.level) ||
    c.level < 1 ||
    c.level > 10
  ) {
    throw new CatalogValidationError(
      `HairColor "${c.id}" has invalid level "${String(c.level)}"; must be an integer 1..10.`
    );
  }
  if (typeof c.family !== 'string' || !HAIR_COLOR_FAMILIES.has(c.family)) {
    throw new CatalogValidationError(
      `HairColor "${c.id}" has invalid family "${String(c.family)}".`
    );
  }
  if (
    typeof c.temperature !== 'string' ||
    !HAIR_COLOR_TEMPERATURES.has(c.temperature)
  ) {
    throw new CatalogValidationError(
      `HairColor "${c.id}" has invalid temperature "${String(c.temperature)}".`
    );
  }
  if (typeof c.targetLab !== 'object' || c.targetLab === null) {
    throw new CatalogValidationError(
      `HairColor "${c.id}" must have a targetLab object.`
    );
  }
  const lab = c.targetLab as Record<string, unknown>;
  if (
    !isFiniteNumber(lab.l) ||
    lab.l < 0 ||
    lab.l > 100 ||
    !isFiniteNumber(lab.a) ||
    Math.abs(lab.a) > 60 ||
    !isFiniteNumber(lab.b) ||
    Math.abs(lab.b) > 60
  ) {
    throw new CatalogValidationError(
      `HairColor "${c.id}" has out-of-range targetLab (L 0..100, |a|,|b| <= 60).`
    );
  }
  if (!isFiniteNumber(c.opacity) || c.opacity < 0 || c.opacity > 1) {
    throw new CatalogValidationError(
      `HairColor "${c.id}" has invalid opacity "${String(c.opacity)}"; must be 0..1.`
    );
  }
  if (
    !isFiniteNumber(c.highlightRetention) ||
    c.highlightRetention < 0 ||
    c.highlightRetention > 1
  ) {
    throw new CatalogValidationError(
      `HairColor "${c.id}" has invalid highlightRetention "${String(c.highlightRetention)}"; must be 0..1.`
    );
  }
  if (c.minimumRecommendedStartingLevel !== undefined) {
    if (
      !isFiniteNumber(c.minimumRecommendedStartingLevel) ||
      !Number.isInteger(c.minimumRecommendedStartingLevel) ||
      c.minimumRecommendedStartingLevel < 1 ||
      c.minimumRecommendedStartingLevel > 10
    ) {
      throw new CatalogValidationError(
        `HairColor "${c.id}" has invalid minimumRecommendedStartingLevel "${String(
          c.minimumRecommendedStartingLevel
        )}"; must be an integer 1..10.`
      );
    }
  }

  return c as unknown as HairColor;
}

/**
 * Validates a single Hairstyle entry, throwing CatalogValidationError with a
 * descriptive message on the first violation found.
 */
export function validateHairstyle(value: unknown): Hairstyle {
  if (typeof value !== 'object' || value === null) {
    throw new CatalogValidationError('Hairstyle entry must be an object.');
  }
  const s = value as Record<string, unknown>;

  if (!isKebabCase(s.id)) {
    throw new CatalogValidationError(
      `Hairstyle id "${String(s.id)}" must be a non-empty kebab-case string.`
    );
  }
  if (typeof s.name !== 'string' || s.name.trim() === '') {
    throw new CatalogValidationError(
      `Hairstyle "${s.id}" must have a non-empty name.`
    );
  }
  if (typeof s.assets !== 'object' || s.assets === null) {
    throw new CatalogValidationError(
      `Hairstyle "${s.id}" must have an assets object.`
    );
  }
  const assets = s.assets as Record<string, unknown>;
  if (typeof assets.front !== 'string' || assets.front.trim() === '') {
    throw new CatalogValidationError(
      `Hairstyle "${s.id}" must have a non-empty assets.front path.`
    );
  }
  if (
    !Array.isArray(s.lengths) ||
    s.lengths.length === 0 ||
    !s.lengths.every(
      (l) => typeof l === 'string' && HAIRSTYLE_LENGTHS.has(l)
    )
  ) {
    throw new CatalogValidationError(
      `Hairstyle "${s.id}" must have a non-empty lengths array of valid values.`
    );
  }
  if (
    !Array.isArray(s.fringe) ||
    s.fringe.length === 0 ||
    !s.fringe.every((f) => typeof f === 'string' && HAIRSTYLE_FRINGES.has(f))
  ) {
    throw new CatalogValidationError(
      `Hairstyle "${s.id}" must have a non-empty fringe array of valid values (use ["none"] if no bangs).`
    );
  }
  if (
    !Array.isArray(s.textures) ||
    s.textures.length === 0 ||
    !s.textures.every(
      (t) => typeof t === 'string' && HAIRSTYLE_TEXTURES.has(t)
    )
  ) {
    throw new CatalogValidationError(
      `Hairstyle "${s.id}" must have a non-empty textures array of valid values.`
    );
  }
  if (
    !Array.isArray(s.attributes) ||
    !s.attributes.every((a) => typeof a === 'string')
  ) {
    throw new CatalogValidationError(
      `Hairstyle "${s.id}" must have an attributes array of strings.`
    );
  }

  return s as unknown as Hairstyle;
}

let cachedColors: readonly HairColor[] | null = null;
let cachedHairstyles: readonly Hairstyle[] | null = null;

/**
 * Loads, validates, and freezes the seed hair color catalog.
 * Throws CatalogValidationError if any entry is malformed or ids collide.
 */
export function loadColors(): HairColor[] {
  if (cachedColors) {
    return cachedColors as HairColor[];
  }
  const raw = colorsData as unknown[];
  const validated = raw.map((entry) => validateHairColor(entry));
  assertUniqueIds(
    validated.map((c) => c.id),
    'HairColor'
  );
  const frozen = Object.freeze(validated.map((c) => Object.freeze(c)));
  cachedColors = frozen;
  return frozen as HairColor[];
}

/**
 * Loads, validates, and freezes the seed hairstyle catalog.
 * Throws CatalogValidationError if any entry is malformed or ids collide.
 */
export function loadHairstyles(): Hairstyle[] {
  if (cachedHairstyles) {
    return cachedHairstyles as Hairstyle[];
  }
  const raw = hairstylesData as unknown[];
  const validated = raw.map((entry) => validateHairstyle(entry));
  assertUniqueIds(
    validated.map((s) => s.id),
    'Hairstyle'
  );
  const frozen = Object.freeze(validated.map((s) => Object.freeze(s)));
  cachedHairstyles = frozen;
  return frozen as Hairstyle[];
}
