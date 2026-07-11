# SUMMARY — Iteration 2 (Milestone M2: color math + query parser + search UI)

**Executor:** Sonnet 5 · **Date:** 2026-07-10

## 1. Scope-item mapping (what was done)

1. **Housekeeping** — `src/catalog/types.ts`: the three `Array<...>` fields on
   `Hairstyle` (`lengths`, `fringe`, `textures`) changed to `(...)[]` syntax.
   No other type changes. `npm run lint` now reports 0 errors, 0 warnings.

2. **Color math — `src/color/`**
   - `lab.ts`: `srgbToLab`/`labToSrgb` implementing the standard sRGB -> linear
     -> XYZ (D65) -> CIELAB pipeline (and its inverse), plus `labToCss` for
     `#rrggbb` swatch strings. RGB is 0-255 integers at the API boundary;
     out-of-gamut Lab-to-RGB results are clamped.
   - `depth.ts`: `estimateStartingLevel` (linear interpolation between the
     seed anchors L9=level1, L80=level10, clamped, rounded) and `depthGroup`
     (1-2 very-dark, 3-4 dark, 5-6 medium, 7-8 light, 9-10 very-light).
   - `recolor.ts`: `recolorPixel` implementing the settled model exactly —
     chroma blended fully to the target a/b, lift-limited lightening
     (`maxLift = 12 + 10*(1-opacity)`, unrestricted darkening), highlight
     retention (`mix(targetL, origL, highlightRetention*0.5)`), then a final
     per-channel blend by `opacity * confidence * intensity`. Exported the
     `mix` and `computeMaxLift` helpers as required so tests can target them
     directly.
   - Tests: `src/color/__tests__/lab.test.ts`, `depth.test.ts`,
     `recolor.test.ts` — round-trip grid (+/-2 per channel), white/black/
     mid-grey reference points, `estimateStartingLevel` anchors and clamping,
     pastel-pink lift-limiting on a very dark pixel, near-target result on a
     light-blonde pixel, monotonicity across a grey ramp, exact passthrough
     at confidence=0 and intensity=0, and unrestricted darkening (blue-black
     over light blonde reaching near its target L). 39 assertions total
     (above the ~20 requested).

3. **Query parser + search — `src/search/`**
   - `parser.ts`: `parseQuery` — lowercases and tokenizes (punctuation and
     hyphens normalized to spaces), resolves multi-word phrases (curtain,
     blunt, and wispy bangs; side swept; shoulder, bob, and pixie length;
     afro textured; with/without plus bangs/fringe) before single-token
     synonyms, then single-token synonyms for length, texture, temperature,
     family, and level-hint, drops stop words, and keeps leftover tokens as
     `attributeTerms`. Negation ("no"/"without" + bangs/fringe) sets
     `requiresFringe:false`; "with"/unqualified bangs/fringe sets `true`.
     Explicit depth words (dark/medium/light) always win over the ambiguous
     family-derived fallback hints (blonde maps to light, brunette/brown map
     to medium, black maps to dark) — for example "dark brown" resolves to
     `dark`. "medium" is treated as both a length term and a color-level
     hint since it is genuinely ambiguous between the two axes.
   - `scorer.ts`: `searchHairstyles` (score =
     lengthMatch*5 + fringeMatch*4 + textureMatch*3 + attributeMatches*1;
     hard-excludes `["none"]`-only styles when `requiresFringe:true` and
     bangs-only styles when `requiresFringe:false`; zero-score results
     omitted; all-stop-word/empty queries return every style unranked at
     score 0 in catalog order) and `searchColors` (filters by family,
     temperature, and level-hint band, each independently optional).
   - Tests: `src/search/__tests__/parser.test.ts` (negation, multi-word
     synonyms, explicit-vs-fallback level hints, stop-word-only query, empty
     string, leftover attribute terms) and `scorer.test.ts` (all five
     canonical queries from the handoff, plus the unranked-fallback and
     unconstrained-color-filter cases). See section 2 for one scoped
     deviation on canonical query 2's top-result claim.

4. **Search UI — `src/ui/SearchScreen.tsx`**, wired into `App.tsx`
   - `TextInput` search box; parses on every keystroke (no debounce, per the
     handoff, since the catalog is tiny). `FlatList` of hairstyle results,
     each showing the style name, its matched length/fringe/texture tags,
     and a horizontal `ScrollView` row of color swatches (background from
     `labToCss(color.targetLab)`, label = `displayName`). `SafeAreaView`,
     dark-on-light styling, no navigation library. `App.tsx` now renders
     `SearchScreen` directly (replacing the old catalog-count placeholder
     view) plus the `StatusBar`.

5. **Verification** — all four mandatory commands run; verbatim output in
   section 3.

6. **Commit** — one commit, `20711ee`: "Iteration 2: color math, query
   parser, search UI" (19 files changed). Staged together: all iteration-2
   code and tests, the `types.ts` fix, `App.tsx`, the pre-existing
   (planner-authored) `docs/HANDOFF.md` and `docs/PROGRESS.md` updates
   already sitting in the working tree at handoff time, and the pre-existing
   Iteration-1 `docs/SUMMARY.md`. This file was then overwritten with the
   Iteration-2 report below the commit, left uncommitted for review, per the
   handoff's deliverable instructions.

## 2. Deviations from the handoff

- **Canonical query 2 ("short and curly") top-result claim, softened.** The
  16-style seed catalog (unchanged, out of scope to edit) has no single style
  that is both `short` length and `curly` texture — the only `short` style is
  Pixie Crop (straight) and the `curly`-tagged style is Curly Shag (medium).
  Under the specified additive scoring formula, Pixie Crop (lengthMatch*5)
  outranks Curly Shag (textureMatch*3), so no style can literally be
  "short+curly." Per the handoff's own allowance ("assert on ids/properties,
  not brittle exact orderings beyond the top result where stated"), the test
  instead asserts the two properties the data can actually support: (a) no
  `long` style appears among the top-scoring results, and (b) every returned
  result matches short length or curly texture. This is a test-writing
  accommodation only; the scorer implementation is unchanged from the
  handoff's formula.
- **Canonical query 1 ("shoulder length with bangs") "every result" reading.**
  Read literally, "every result includes shoulder length" cannot coexist with
  an additive (non-hard-filtering) scoring formula, since non-shoulder styles
  with a real fringe still score 4 (`fringeMatch*4`) and are non-zero, hence
  included per the spec's own "zero-score omitted" rule. The hard,
  unconditionally-true part of the requirement — no `["none"]`-only style
  ever appears — is asserted across all results. The shoulder-length part
  is asserted across the top-scoring results only (which are, correctly,
  Side-Swept Lob and Shoulder Layers, both shoulder-length with real fringe).
- **`estimateStartingLevel` return type** is the literal union `1|2|...|10`
  (matching `HairColor['level']`) rather than a bare `number`, since the
  handoff's own signature comment (`1..10`) and the catalog's `level` field
  are both that literal union; this is a strengthening, not a behavior
  change.
- **Ambiguous "medium" token**: the handoff does not specify how to resolve
  "medium" (a valid `Hairstyle['lengths']` value and also a `colorLevelHint`
  value) when it appears alone in a query. Implemented as: set both fields
  simultaneously (a query for medium hair length and a query for
  medium-depth color are independent concerns, so there is no harm in
  populating both from the same token). No test in the mandatory list
  exercises this in isolation; canonical query 5's colorLevelHint assertions
  use "dark" and "brown" instead.
- **Lab round-trip test tolerance**: white ({255,255,255}) round-trips to
  `L = 100.0000039` due to ordinary floating-point accumulation in the
  matrix math (not a bug — several decimal digits of matrix constants do not
  invert to bit-exact 100.0). The "L approximately 100" assertion upper
  bound was set to 100.1 instead of 100 to accommodate this; the +/-2-per-
  channel round-trip assertions (the handoff's actual correctness bar) are
  unaffected and pass with real RGB deltas of 0-1 per channel on the tested
  grid.
- No other deviations. Domain shapes, the recolor model's five steps, the
  scoring formula, and the five canonical query behaviors are implemented as
  specified.

## 3. Verbatim verification output

### `npm run typecheck`

```
> maneframe@1.0.0 typecheck
> tsc --noEmit
```

(No output — clean pass, exit 0.)

### `npm run lint`

```
> maneframe@1.0.0 lint
> eslint .
```

(No output — 0 errors, 0 warnings, exit 0. The 3 prior `Array<T>` warnings
from Iteration 1 are gone.)

### `npm test`

```
> maneframe@1.0.0 test
> jest

PASS src/color/__tests__/lab.test.ts
PASS src/search/__tests__/scorer.test.ts
PASS src/color/__tests__/recolor.test.ts
PASS src/search/__tests__/parser.test.ts
PASS src/catalog/__tests__/catalog.test.ts
PASS src/color/__tests__/depth.test.ts

Test Suites: 6 passed, 6 total
Tests:       88 passed, 88 total
Snapshots:   0 total
Time:        1.62 s
Ran all test suites.
```

(22 pre-existing catalog tests + 66 new color/search tests = 88 total, all
passing.)

### `npx expo export --platform android`

```
Starting Metro Bundler

Android Bundled 3430ms index.ts (586 modules)

› android bundles (1):
_expo/static/js/android/index-5cd6092a8caf7163e85b419465a5184d.hbc (1.5MB)

› Files (1):
metadata.json (150B)

Exported: dist
```

Confirms Metro bundles the new `App.tsx` -> `SearchScreen` -> `search`/
`color`/`catalog` module graph end-to-end with no errors (586 modules, up
from 582 in Iteration 1 — the four new non-test source modules). `dist/` and
`.expo/` are gitignored and were not committed.

## 4. File inventory

New this iteration:

```
src/color/lab.ts
src/color/depth.ts
src/color/recolor.ts
src/color/__tests__/lab.test.ts
src/color/__tests__/depth.test.ts
src/color/__tests__/recolor.test.ts
src/search/parser.ts
src/search/scorer.ts
src/search/__tests__/parser.test.ts
src/search/__tests__/scorer.test.ts
src/ui/SearchScreen.tsx
```

Modified:

```
src/catalog/types.ts   (Array<T> -> T[] on 3 Hairstyle fields; no shape change)
App.tsx                (renders SearchScreen instead of the catalog-count placeholder)
docs/SUMMARY.md         (this file; Iteration-1 report replaced with this Iteration-2 report)
```

Removed (superseded by real content):

```
src/color/.gitkeep
src/search/.gitkeep
src/ui/.gitkeep
```

Untouched (per hard constraints): `docs/HANDOFF.md` and `docs/PROGRESS.md`
were not edited by this executor — both already contained planner (Fable 5)
updates in the working tree at handoff time (Iteration 2 scope text, and the
Iteration 1 acceptance log entry respectively), which were staged and
committed as-is alongside this iteration's code, unmodified by Sonnet 5.
`.claude/` was not touched. No native-module libraries, no prebuild, no new
runtime dependencies were introduced — everything added is pure TypeScript
(dev-only test tooling already existed from Iteration 1).

Commit: `20711ee` "Iteration 2: color math, query parser, search UI" (19
files changed, 1700 insertions, 148 deletions — the deletions are almost
entirely the old `HANDOFF.md`/`App.tsx` content being replaced and the three
`.gitkeep` removals).

## 5. Known issues / risks / suggestions for next iteration

- **`recolorPixel`'s chroma step blends a/b 100% to the target** (per the
  handoff's exact model — "blend a/b fully toward target"), so all hue and
  chroma variation in the recolor comes from the luminance channel only.
  This is by design per the settled spec, but worth flagging in case a
  future iteration wants partial-chroma blending for more subtlety (for
  example very sheer fashion tones over a strongly pigmented original).
  Should M3+ want that, it is a small, additive change to `recolor.ts`.
- **The attribute-matching heuristic in `scorer.ts`** (`a === term ||
  a.includes(term) || term.includes(a)`) is intentionally loose so that a
  query token like "bob" matches the hyphenated attribute "long-bob". This
  is what makes canonical query 4 (the "...bob" query) favor Classic Lob. It
  could over-match on short/common substrings in a larger catalog (for
  example "bob" would also match a hypothetical "adobe" attribute); fine at
  16 styles, worth tightening (for example word-boundary splitting attribute
  hyphens) if the catalog grows substantially in M3+.
- **Canonical query 2 data gap** (see deviation above): the seed hairstyle
  catalog has no short+curly style. If a future iteration wants that
  canonical query to have a literal short+curly top result, it would
  require either adding such a style to `hairstyles.json` (out of this
  iteration's scope) or accepting the current "no long styles, matches
  short-or-curly" behavior as correct.
- **SearchScreen has no debounce and no memoization beyond `useMemo` on the
  parsed query and results** — fine at 40 colors and 16 styles; would need
  real virtualization and debouncing if catalogs grow by orders of
  magnitude, per the product's still-offline, still-tiny-catalog assumption.
- **Color swatches render as flat circles**, not against a hair silhouette —
  intentional per M2 scope (search UI only); real preview compositing is M3
  (`MockHairSegmenter` + Skia).
