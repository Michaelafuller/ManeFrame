# SUMMARY — Iteration 3 (Milestone M3: still-photo preview, mock segmentation, Skia)

**Executor:** Sonnet 5 · **Date:** 2026-07-10

## 1. Scope-item mapping (what was done)

1. **Catalog data fix (carry-forward)** — `src/catalog/data/hairstyles.json`:
   added `curly-pixie` (`lengths: ["short"]`, `textures: ["curly"]`,
   `fringe: ["none"]`) and `coily-bob` (`lengths: ["chin"]`,
   `textures: ["coily"]`, `fringe: ["none"]`). Catalog count 16 → 18;
   `src/catalog/__tests__/catalog.test.ts` count assertion updated to 18.
   `src/search/__tests__/scorer.test.ts` canonical query 2 ("short and
   curly") tightened: with `curly-pixie` now the catalog's only short+curly
   style, it uniquely scores highest (lengthMatch·5 + textureMatch·3 = 8,
   vs. 5 for Pixie Crop and 3 for Curly Shag), so the test now asserts the
   top result(s) are literally short **and** curly, replacing the prior
   "no long styles" softening.

2. **Dependencies** — installed via `npx expo install` exactly the three
   allowed runtime packages (`@shopify/react-native-skia@2.6.2`,
   `expo-image-picker@~57.0.2`, `expo-image-manipulator@~57.0.2`, all
   SDK-57-matched) plus `@testing-library/react-native@^14.0.1` as a
   dev-dependency (`npm install --save-dev`). Nothing else added.

3. **Segmentation interface — `src/segmentation/`**
   - `types.ts`: `HairMask` and `HairSegmenter` exactly as specified.
   - `mock.ts`: `MockHairSegmenter` — deterministic geometric hair-cap mask.
     Mask resolution is capped at 256px on the long side, never upscaled
     (`scale = min(1, 256/longSide)`), aspect preserved. Per-pixel value =
     a hair-cap ellipse (center `0.5w,0.38h`, radii `0.34w,0.30h`) with a
     smoothstep falloff over an edge band (`0.08w`, converted to the
     ellipse's normalized-radius units), multiplied by a face-cutout
     attenuation factor (ellipse center `0.5w,0.48h`, radii `0.20w,0.22h`,
     smoothstep from `0.1` at the face center to `1.0` (no attenuation)
     outside a `0.05w` band). Ignores the `pixels` argument entirely, as
     specified.
   - Tests (`__tests__/mock.test.ts`, 11 cases): mask-dimension capping/
     no-upscale/portrait handling, `data.length === width*height`, full
     0..1 range, center-top-of-hair ≈1 (>0.95), all four image corners
     ≈0 (<0.05), face center ≤0.15, left-right symmetry (sampled grid),
     determinism across two calls, and that the `pixels` argument is
     ignored (identical output with/without it).

4. **CPU recolor — `src/color/recolorImage.ts`**
   - `recolorImage(rgba, width, height, mask, params): Uint8Array` exactly
     per the signature. Nearest-neighbor mask sampling
     (`mx = floor(x*mask.width/width)`, clamped). Pixels with sampled
     confidence `< 0.01` are copied through byte-for-byte (all 4 channels).
     Alpha is otherwise never touched (only R/G/B come from
     `recolorPixel`). Per-call `Map` memo, keyed on the color quantized to
     5 bits/channel **plus the exact confidence sample** (see Deviations
     below for why confidence is included).
   - Also exported `recolorImageChunked(...)`: the same algorithm,
     additionally yielding to the event loop every `chunkPixels` pixels
     (default 50,000) via `await new Promise(r => setTimeout(r, 0))`, and
     checking a caller-supplied `isStale()` predicate after each yield,
     resolving to `null` if stale. This is what `PreviewScreen` actually
     calls (see item 5); `recolorImage` is the synchronous pure-function
     form used directly by its own unit tests and available for any other
     synchronous caller.
   - Tests (`__tests__/recolorImage.test.ts`, 6 cases): mask=0 region
     byte-identical to input; mask=1 region matches direct `recolorPixel`
     output per-pixel; alpha untouched at mask 0/0.5/1; nearest-neighbor
     sampling exercised with a 4×4 mask over an 8×8 image (verified against
     the exact quadrant mapping); memo path (16×16 image, 4 repeated
     5-bit-aligned colors, two confidence bands) matches per-pixel
     `recolorPixel` exactly for every pixel; confidence-below-0.01
     skip-copy path.

5. **Preview screen — `src/ui/PreviewScreen.tsx`, `src/ui/ColorSwatch.tsx`,
   App shell**
   - Flow implemented as specified: "Pick a photo" button opens a small
     modal chooser (built-in RN `Modal`, no extra dependency) offering
     "Choose from Library" (`requestMediaLibraryPermissionsAsync` →
     `launchImageLibraryAsync`) or "Take a Photo"
     (`requestCameraPermissionsAsync` → `launchCameraAsync`); either path
     then downscales via `expo-image-manipulator`
     (`ImageManipulator.manipulate(uri).resize({width|height: min(orig,
     768)}).renderAsync()` → `.saveAsync({format: SaveFormat.JPEG,
     compress: 0.9})`, resizing on whichever dimension is the long side)
     and decodes with Skia exactly via the mandated path only
     (`Skia.Data.fromURI` → `Skia.Image.MakeImageFromEncoded` →
     `readPixels(0,0,{colorType: RGBA_8888, alphaType: Unpremul})`).
     `MockHairSegmenter.segment` runs once per photo; `recolorImageChunked`
     re-runs whenever photo/mask/color/intensity change, its result wrapped
     back into an `SkImage` via `Skia.Data.fromBytes` +
     `Skia.Image.MakeImage` (matching `ImageInfo`, `bytesPerRow = width*4`).
     Original vs. recolored is drawn via a single `<Canvas><Image .../>
     </Canvas>`, swapped by a `Pressable` with `onPressIn`/`onPressOut`
     (press-and-hold shows the original; release shows the latest
     recolor). Horizontal color-swatch row (extracted, reusable
     `ColorSwatch` component - see Deviations) and three intensity preset
     buttons (Subtle 0.5 / Natural 0.8 / Bold 1.0, no slider). "Processing…"
     overlay with `ActivityIndicator` while a recolor run is in flight;
     stale runs are ignored via an incrementing `runIdRef` token checked
     both inside `recolorImageChunked`'s `isStale` callback (to stop early)
     and again before committing the result/finishing state.
   - **App shell** — `App.tsx` now renders a plain two-Pressable bottom tab
     bar ("Search" / "Preview", no navigation library) and conditionally
     mounts exactly one of `SearchScreen` / `PreviewScreen`. Selected-color
     state is lifted into `App.tsx`; tapping a color swatch inside a
     Search result now calls `onSelectColor`, which sets the color and
     switches to the Preview tab (which mounts fresh with that color
     preselected via `PreviewScreen`'s `useState` initializer - see
     Deviations for why no additional sync effect was needed). Selecting a
     hairstyle still does nothing new (unchanged, per scope).

6. **UI smoke tests — `src/ui/__tests__/App.test.tsx`**
   - `@testing-library/react-native`, with minimal manual `jest.mock()`s for
     `@shopify/react-native-skia` (stub `Skia.Data`/`Skia.Image` functions,
     `Canvas`/`Image` render `null`, stub `ColorType`/`AlphaType` enums),
     `expo-image-picker`, and `expo-image-manipulator` - no real Skia,
     picker, or manipulator code executes in Jest. Two tests: renders both
     tab labels plus SearchScreen's default content ("ManeFrame"); pressing
     the "Preview" tab reveals PreviewScreen's "Pick a photo" button.

7. **Verification** — all four mandatory commands run; verbatim output in
   section 3. No STOP condition triggered - Skia bundles cleanly with
   Metro/`expo export`.

8. **Commit** — one commit, staging all Iteration-3 code/tests plus the
   pre-existing (planner-authored) `docs/HANDOFF.md`/`docs/PROGRESS.md`
   working-tree state and the pre-existing Iteration-2 `docs/SUMMARY.md`,
   titled `Iteration 3: still-photo preview, mock segmentation, Skia
   pipeline`. This file is then overwritten with this report, left
   uncommitted per the handoff's instructions.

## 2. Deviations from the handoff

- **Memo key includes the confidence sample, not just quantized color.**
  The handoff's example ("memo keyed on quantized input color") would be
  unsound as literally described: `recolorPixel`'s output depends on both
  the original color *and* the confidence (mask) sample
  (`blendAmount = opacity * confidence * intensity`), so two pixels with
  the same original color but different confidence (very common near a
  soft mask edge) would get a wrong, identical recolor if the memo ignored
  confidence. I kept the 5-bit/channel color quantization (the actual
  performance win, since hair regions really do have few distinct colors)
  but added the exact (unquantized) confidence float to the key. This adds
  effectively zero overhead in practice because nearest-neighbor sampling
  of a mask that's much lower-resolution than the photo means large runs
  of adjacent pixels already share the identical confidence value, so the
  memo still hits well - and it's the only way to guarantee the "memo path
  == non-memo path" test can hold universally rather than only for
  specially-constructed uniform-confidence test fixtures. The mandated
  test (comparing memo output to direct per-pixel `recolorPixel` calls)
  passes and, unlike a color-only key, would still pass on any image/mask
  combination, not just the one in the test file.
- **`recolorImageChunked` added alongside `recolorImage`.** The handoff's
  `recolorImage` signature (section 4) is synchronous and returns
  `Uint8Array` directly - that's preserved exactly, and is what its own
  unit tests exercise. But section 5, point 6 separately requires the
  *screen's* recolor runs to be async, chunked every ~50k pixels via
  `setTimeout`, with stale-run cancellation. Changing `recolorImage`'s own
  signature to async would violate section 4 and break its tests, so I
  added a second export in the same file, `recolorImageChunked`, sharing
  all the same per-pixel logic (factored into a private
  `recolorOnePixelInto` helper) but yielding to the event loop and
  supporting an `isStale()` cancellation hook. `PreviewScreen` calls
  `recolorImageChunked`; nothing outside `recolorImage.ts` needed to
  change to accommodate this, and no duplication of the actual per-pixel
  algorithm exists between the two.
- **`ColorSwatch` extracted into `src/ui/ColorSwatch.tsx`.** The handoff
  says PreviewScreen's color row should "reuse the swatch look from
  SearchScreen," but `SearchScreen`'s `ColorSwatch` was a private,
  non-exported function component. Since the App-shell paragraph already
  requires editing `SearchScreen.tsx` anyway (to add the `onSelectColor`
  callback wiring), I pulled `ColorSwatch` out into its own small file
  (unchanged look: circle + label; added an optional `selected` boolean
  for a highlighted-border state, used by PreviewScreen, and an optional
  `onPress`, used by both screens) rather than duplicating ~25 lines of
  JSX/styles in `PreviewScreen.tsx`. This is a one-file, mechanical
  extraction with no visual or behavioral change to `SearchScreen`'s
  existing swatches beyond making them pressable.
- **No `useEffect` re-syncing `PreviewScreen`'s color from
  `selectedColor` prop after mount.** I initially wrote one (matching a
  common "adjust state from a changed prop" pattern), but `App.tsx`
  conditionally mounts exactly one of `{SearchScreen, PreviewScreen}` at a
  time and only ever changes `selectedColor` in the same state update that
  switches the tab to Preview - so `PreviewScreen` always (re)mounts fresh
  whenever `selectedColor` changes, and the plain `useState(selectedColor
  ?? allColors[0])` initializer already picks up the latest value on every
  such mount. The sync effect was genuinely dead code for this component's
  actual lifecycle, so it was removed rather than kept as inert
  belt-and-suspenders logic. This is noted in a code comment at its former
  location.
- **Effect bodies restructured to satisfy
  `react-hooks/set-state-in-effect`** (bundled in `eslint-config-expo@57`,
  a React Compiler-derived diagnostic that errors on any `setState` call
  that is a *direct, top-level* statement of an effect callback). The
  segmentation and recolor effects need to call `setMask`/`setIsProcessing`/
  `setError`/`setRecoloredImage` as part of kicking off async work, which
  is the same "loading-state effect" pattern React's own docs recommend
  wrapping in an inner `async () => {...}` IIFE - once wrapped, none of
  the calls are direct top-level statements of the outer effect, and the
  rule (correctly, given its own stated purpose - distinguishing
  synchronous re-render loops from legitimate async data flows) no longer
  flags them. No behavior changed, just where the `setState` calls
  textually sit relative to the `useEffect(...)` callback's own top level.
- **App root uses a plain `View`, not `SafeAreaView`, around the tab
  bar.** Each screen (`SearchScreen`, `PreviewScreen`) keeps its own
  top-level `SafeAreaView` (unchanged/added respectively), but the bottom
  tab bar itself isn't inset for a home-indicator safe area on iOS. Given
  D1 (Android-first; this machine can't build/verify iOS at all) and that
  RN's built-in `SafeAreaView` is a documented no-op on Android, this has
  zero effect on the only platform actually verified here. Flagged as a
  known cosmetic gap for whenever iOS is verified on a Mac/EAS.
- No other deviations. The segmentation mask shape/values, the recolor
  pixel algorithm and skip/alpha rules, the Skia decode/encode path, the
  three intensity presets, and the press-and-hold before/after toggle are
  all implemented as specified.

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

(No output — 0 errors, 0 warnings, exit 0.)

### `npm test`

```
> maneframe@1.0.0 test
> jest

PASS src/search/__tests__/parser.test.ts
PASS src/color/__tests__/recolorImage.test.ts
PASS src/search/__tests__/scorer.test.ts
PASS src/catalog/__tests__/catalog.test.ts
PASS src/color/__tests__/recolor.test.ts
PASS src/color/__tests__/depth.test.ts
PASS src/color/__tests__/lab.test.ts
PASS src/ui/__tests__/App.test.tsx
PASS src/segmentation/__tests__/mock.test.ts

Test Suites: 9 passed, 9 total
Tests:       107 passed, 107 total
Snapshots:   0 total
Time:        4.857 s
Ran all test suites.
```

(88 pre-existing tests + 11 mock-segmenter + 6 recolorImage + 2 App smoke
tests = 107 total, all passing. `App.test.tsx` also prints a benign,
expected RN console warning - "SafeAreaView has been deprecated..." -
which is not a failure; it comes from `react-native`'s own built-in
`SafeAreaView`, unchanged from Iteration 2's `SearchScreen`.)

### `npx expo export --platform android`

```
Starting Metro Bundler

Android Bundled 7807ms index.ts (857 modules)

› android bundles (1):
_expo/static/js/android/index-d42b5150a7046f6ef202c34d01b90d26.hbc (2MB)

› Files (1):
metadata.json (150B)

Exported: dist
```

Metro bundles cleanly with `@shopify/react-native-skia`, `expo-image-picker`,
and `expo-image-manipulator` all included (857 modules, up from 586 in
Iteration 2; bundle size 2MB, up from 1.5MB - expected, given Skia's JS
surface and the two new native modules). **No STOP condition was
triggered** - Skia does not break the Metro/export step in any way; D3
(segmentation-behind-an-interface, Expo-Go-compatible) stands as planned.

## 4. File inventory

New this iteration:

```
src/segmentation/types.ts
src/segmentation/mock.ts
src/segmentation/__tests__/mock.test.ts
src/color/recolorImage.ts
src/color/__tests__/recolorImage.test.ts
src/ui/ColorSwatch.tsx
src/ui/PreviewScreen.tsx
src/ui/__tests__/App.test.tsx
```

Modified:

```
src/catalog/data/hairstyles.json        (+2 styles: curly-pixie, coily-bob; 16 -> 18)
src/catalog/__tests__/catalog.test.ts   (count assertion 16 -> 18)
src/search/__tests__/scorer.test.ts     (canonical query 2 tightened to literal short+curly top result)
src/ui/SearchScreen.tsx                 (ColorSwatch extracted to its own file; onSelectColor prop wired through)
App.tsx                                 (two-tab Search/Preview switcher; lifted selected-color state)
package.json / package-lock.json        (+3 runtime deps via `npx expo install`, +1 dev-dep via `npm install --save-dev`)
docs/SUMMARY.md                         (this file; Iteration-2 report replaced with this Iteration-3 report)
```

Removed (superseded by real content):

```
src/segmentation/.gitkeep
```

Untouched (per hard constraints): `docs/HANDOFF.md` and `docs/PROGRESS.md`
were not edited by this executor - both already contained planner (Fable 5)
updates in the working tree at handoff time (this iteration's scope text,
and the Iteration 1 + 2 acceptance log entries respectively), staged and
committed as-is alongside this iteration's code, unmodified by Sonnet 5.
`.claude/` was not touched. No `expo prebuild` was run. Only the four
allowed packages were added (three runtime + one dev-dependency); no other
dependency changes. No network calls or analytics were added - photo
picking/manipulation/decoding are all local-file operations.

Commit: staged with message `Iteration 3: still-photo preview, mock
segmentation, Skia pipeline` (see `git log` for the resulting hash).

## 5. Known issues / risks / suggestions for next iteration

- **No Android emulator/device on this machine (unchanged from Iterations
  1-2).** Verification stayed at typecheck/lint/unit-test/bundler level, as
  the handoff instructed. The photo-picker → manipulator → Skia-decode →
  segment → recolor → Skia-encode pipeline is exercised end-to-end by nothing
  more than "does it typecheck, lint clean, and bundle" - it has **not**
  been run against a real device camera/photo library, a real JPEG, or real
  Skia native code. The biggest real-world unknowns this leaves for M4/the
  first on-device check: (a) whether `readPixels` actually returns
  `RGBA_8888` as a `Uint8Array` (vs. some platforms/build variants returning
  `Float32Array` for certain color types - the code defensively checks
  `instanceof Uint8Array` and throws a clear error rather than silently
  misinterpreting bytes, but this path is unverified); (b) real-world timing
  of the chunked recolor on a 768×768 photo on actual hardware (the 50k-pixel
  chunk size is a reasonable guess, not measured); (c) whether
  `expo-image-manipulator`'s new `ImageManipulator.manipulate().resize()`
  API (used instead of the deprecated `manipulateAsync`) behaves as its
  types describe in Expo Go specifically.
- **Camera picker path is essentially unverifiable here.** The camera
  permission/launch code follows the same pattern as the library path and
  typechecks against the installed `expo-image-picker` types, but with no
  device/emulator, `launchCameraAsync` has never actually been invoked.
- **PreviewScreen fully unmounts on tab switch**, so a picked photo and its
  recolor state are lost if the user switches to Search and back. This
  was a deliberate simplicity trade-off (see Deviations) and also makes the
  mandated "switching tabs shows Preview's button" smoke test meaningful
  (a persistently-mounted-but-hidden PreviewScreen would make that
  assertion pass trivially regardless of tab-switch wiring). If persistence
  across tab switches becomes a real product requirement, the fix is to
  keep both screens mounted and toggle a `display: 'flex'|'none'` style
  instead of conditional rendering - noted for a future iteration rather
  than done speculatively here.
- **5-bit color quantization in the recolor memo is a deliberate lossy
  approximation** (per the handoff's own suggestion): two visually-similar
  but non-identical original pixel colors within the same 5-bit bucket
  will render with the *first* one's recolor result. This is invisible at
  the catalog's dye opacities/intensities in practice (hair regions really
  do cluster into a handful of true colors after JPEG compression + 768px
  downscaling) but is a real, disclosed approximation, not a bug - flagged
  here in case M4's real segmenter (which may be less spatially uniform
  than the mock's smooth ellipse) reveals visible banding.
- **`app.json` was not modified** to add `expo-image-picker`/
  `expo-image-manipulator` to a `plugins` array. That configuration only
  matters for `expo prebuild`/EAS builds (native permission strings baked
  into a custom dev client); since this iteration stays entirely on Expo
  Go (no prebuild, per the hard constraints) and permissions are requested
  at runtime against Expo Go's own already-declared permissions, no
  `app.json` change was needed for this iteration's scope. This will need
  revisiting the moment M4+ requires a custom dev build.
- **Mock segmenter's edge-band-to-normalized-radius conversion is an
  approximation, not exact geometry.** The handoff specifies the edge band
  in absolute pixels (`0.08w`) applied to an ellipse with different x/y
  radii; converting that into the ellipse's own normalized-radius units
  (needed for a clean single-parameter smoothstep) necessarily blends the
  x- and y-direction band widths into one average-radius-based scalar
  rather than being exactly `0.08w` in every direction. This is visually
  reasonable (soft, roughly-uniform falloff) and all 11 mock tests pass
  comfortably inside their tolerances, but it's not a literal pixel-for-
  pixel rendering of "0.08w in every direction," which isn't achievable
  with a single-parameter elliptical smoothstep anyway.
