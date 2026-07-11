# HANDOFF — Iteration 2 (Milestone M2: color math + query parser + search UI)

**Author:** Fable 5 (planner) · **Executor:** Sonnet 5 · **Date:** 2026-07-10

## Context

Iteration 1 (commit `0bbec82`) is accepted: Expo SDK 57 TS scaffold, domain
types in `src/catalog/types.ts`, seed catalogs (40 colors / 16 hairstyles) with
validated loaders, 22 passing tests. Read `docs/PROGRESS.md` for architecture
decisions D1–D6. This iteration is **pure TypeScript** — still no native
modules, no prebuild.

## Scope — do ALL of the following, and NOTHING outside it

### 1. Housekeeping

- In `src/catalog/types.ts`, change the three `Array<...>` fields to `(...)[]`
  syntax to clear the 3 ESLint warnings. No other type changes. After this,
  `npm run lint` must report **0 errors, 0 warnings**.

### 2. Color math — `src/color/`

All pure functions, no React imports, fully unit-tested.

**`src/color/lab.ts`** — colorimetry:

- `srgbToLab(rgb: {r,g,b}): {l,a,b}` and `labToSrgb(lab): {r,g,b}` using the
  standard sRGB → linear → XYZ (D65) → CIELAB pipeline. RGB channels are
  0–255 integers at the API boundary; clamp out-of-gamut results into 0–255.
- `labToCss(lab): string` returning a `#rrggbb` hex string (for UI swatches).

**`src/color/depth.ts`** — starting-depth model:

- `estimateStartingLevel(labL: number): 1..10` — map hair luminance to the
  10-level depth scale consistently with the seed data (natural level 1 ≈ L 9,
  level 10 ≈ L 80; use linear interpolation with clamping, rounding to the
  nearest level).
- `depthGroup(level): "very-dark"|"dark"|"medium"|"light"|"very-light"`
  (1–2, 3–4, 5–6, 7–8, 9–10).

**`src/color/recolor.ts`** — luminance-preserving recolor reference
implementation (this exact model is settled; implement it, don't redesign):

```ts
export interface RecolorParams {
  color: HairColor;
  intensity: number;          // 0..1 user slider, default 1
}
// confidence: per-pixel hair probability 0..1 (from segmentation, later)
export function recolorPixel(
  original: { r: number; g: number; b: number },
  params: RecolorParams,
  confidence: number
): { r: number; g: number; b: number };
```

Model:
1. `origLab = srgbToLab(original)`.
2. **Chroma**: blend a/b fully toward `color.targetLab` a/b.
3. **Luminance with lift limiting**: a dye can darken freely but can only
   *lighten* a limited amount. Compute
   `maxLift = 12 + 10 * (1 - color.opacity)` (in L units). Target L is
   `min(color.targetLab.l, origLab.l + maxLift)` when lightening, or
   `color.targetLab.l` when darkening.
4. **Highlight retention**: `outL = mix(targetL, origLab.l, color.highlightRetention * 0.5)`
   — keeps some of the original luminance structure so highlights survive.
5. Convert back to sRGB, then final blend:
   `out = mix(original, recolored, color.opacity * confidence * intensity)`.

Export the small helpers (`mix`, the lift computation) so tests can target
them.

**Tests — `src/color/__tests__/`** (aim ~20+ assertions):

- Round-trip: for a grid of sRGB colors, `labToSrgb(srgbToLab(c))` is within
  ±2 per channel. Reference points: white → L≈100, black → L≈0,
  mid-grey (119,119,119) → L≈50±2, a/b≈0 for greys.
- `estimateStartingLevel`: L 9 → 1, L 80 → 10, L 47 → 6 (matches seed natural
  shades); clamps below/above.
- Recolor behavior (use seed catalog shades via `loadColors()`):
  - Pastel pink (`fashion-pastel-pink`) on a very dark pixel (L≈10) lightens
    by **at most** the lift limit — output L stays far below the pastel's
    target L.
  - Pastel pink on a light-blonde pixel (L≈75) lands near the pastel's target.
  - Monotonicity: for the same shade, a brighter input pixel yields a
    brighter output pixel (luminance structure preserved).
  - `confidence = 0` returns the original pixel exactly; `intensity = 0` too.
  - Darkening: black dye over blonde reaches the dye's target L (no limit when
    darkening).

### 3. Query parser + search — `src/search/`

**`src/search/parser.ts`**:

- `parseQuery(text: string): ParsedQuery` where

```ts
export interface ParsedQuery {
  lengths: Hairstyle['lengths'];        // matched length terms
  fringe: Hairstyle['fringe'];          // specific fringe types mentioned
  requiresFringe: boolean | null;       // true "with bangs", false "without/no bangs", null unsaid
  textures: Hairstyle['textures'];
  attributeTerms: string[];             // leftover meaningful tokens (e.g. "bob", "layered")
  colorFamilies: HairColor['family'][]; // e.g. "red", "copper", "ash"
  colorTemperature: HairColor['temperature'] | null; // "warm"/"cool"/"neutral"
  colorLevelHint: 'dark' | 'medium' | 'light' | null; // "dark brown" → dark
}
```

- Lowercase tokenization; multi-word synonym matching BEFORE single-token
  matching (so "curtain bangs" matches as a fringe type, not as the attribute
  "curtain" + generic "bangs").
- Negation: "without bangs", "no bangs", "no fringe" → `requiresFringe:false`.
  "with bangs", "bangs", "fringe" (unqualified) → `requiresFringe:true`.
- Synonym seeds (extend sensibly): bangs/fringe; shoulder/shoulder-length/
  collarbone/lob; chin/bob-length; long/waist; short/cropped/pixie-length;
  wavy/waves/beachy; curly/curls; coily/kinky/afro-textured;
  straight/sleek; warm/golden; cool/ashy/icy; red/ginger/auburn;
  copper/orange; blonde→light hint; brunette/brown→medium-or-dark hint;
  black→dark hint.
- Stop words ("hair", "with", "and", "a", "the", …) dropped; remaining
  unrecognized tokens become `attributeTerms`.

**`src/search/scorer.ts`**:

- `searchHairstyles(query: ParsedQuery, styles: Hairstyle[]): ScoredHairstyle[]`
  with `score = lengthMatch*5 + fringeMatch*4 + textureMatch*3 +
  attributeMatches*1`, where fringeMatch also honors `requiresFringe`
  (styles whose fringe is exactly `["none"]` are **excluded** when
  `requiresFringe === true`, and vice versa styles with only bangs options are
  excluded when `false`). Results sorted by score desc, zero-score results
  omitted; if the query parses to nothing (all-stop-words), return all styles
  unranked.
- `searchColors(query: ParsedQuery, colors: HairColor[]): HairColor[]` —
  filter by family/temperature/level hint (dark → level ≤ 4, medium 5–7,
  light ≥ 8). Any of the three absent → unconstrained.

**Tests — `src/search/__tests__/`** against the real seed catalogs. These five
canonical queries must produce sensible results (assert on ids/properties, not
brittle exact orderings beyond the top result where stated):

1. `"shoulder length with bangs"` → every result includes `shoulder` length
   and has a real fringe; no `["none"]`-only styles.
2. `"short and curly"` → top result is short+curly; no long styles.
3. `"long straight hair without bangs"` → results long+straight, all
   fringe-compatible with "no bangs".
4. `"warm red shoulder-length bob"` → `searchColors` returns only warm
   red-family shades; style results favor shoulder+bob.
5. `"dark brown curtain bangs"` → colors filtered to dark levels
   (level ≤ 4) natural/neutral browns included; styles include curtain-bangs.

Plus parser unit tests: negation, multi-word synonyms, stop-word-only query,
empty string.

### 4. Minimal search UI — `src/ui/SearchScreen.tsx` + wire into `App.tsx`

- A `TextInput` (search box) + results list: each hairstyle result shows name
  + its matched tags; below it, a horizontal row of matching color swatches
  (background color from `labToCss(color.targetLab)`, label = displayName).
- Debounce is unnecessary; parse on every change (catalog is tiny).
- Keep styling minimal but not broken (SafeAreaView, dark-on-light). No
  navigation library — `App.tsx` renders `SearchScreen` directly.
- This must work in plain `expo start` (no native modules).

### 5. Verification (mandatory before writing SUMMARY.md)

```
npm run typecheck   # clean
npm run lint        # 0 errors, 0 warnings
npm test            # all pass (old 22 + new suites)
npx expo export --platform android   # bundles cleanly
```

### 6. Commit

Stage the pre-existing `docs/SUMMARY.md` changes along with your work. One
commit: `Iteration 2: color math, query parser, search UI`.

## Deliverable back to Fable 5

Overwrite `docs/SUMMARY.md` with the Iteration-2 report: same five sections as
Iteration 1 (scope-item mapping, deviations, verbatim verification output,
file inventory, known issues/suggestions).

## Hard constraints

- Do not edit `docs/HANDOFF.md`, `docs/PROGRESS.md`, or anything in `.claude/`.
- No native-module libraries, no prebuild, no network calls, no new runtime
  dependencies at all (dev-deps only if genuinely needed).
- Do not push, and do not create a GitHub repo.
