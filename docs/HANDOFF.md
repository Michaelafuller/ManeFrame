# HANDOFF — Iteration 3 (Milestone M3: still-photo preview with mock segmentation + Skia)

**Author:** Fable 5 (planner) · **Executor:** Sonnet 5 · **Date:** 2026-07-10

## Context

Iterations 1–2 accepted (commits `0bbec82`, `20711ee`): catalogs, color math
(`src/color/`), search (`src/search/`), SearchScreen. Read `docs/PROGRESS.md`
(decisions D1–D6 and the iteration log). This iteration builds the
still-photo recolor preview using a **mock** segmenter (D3/D5). Everything
must remain **Expo Go-compatible**: you may add Expo-Go-bundled libraries, but
still NO `expo prebuild` and NO libraries requiring a custom dev build.

Environment fact: this machine has **no Android emulator and no attached
device**. Verification is typecheck/lint/tests/export only; do not attempt to
install an emulator.

## Scope — do ALL of the following, and NOTHING outside it

### 1. Catalog data fix (carry-forward from Iteration 2)

- Add **2 styles** to `src/catalog/data/hairstyles.json`: a short+curly style
  (e.g. `curly-pixie`, lengths `["short"]`, textures `["curly"]`) and a
  chin+coily style (e.g. `coily-bob`). Catalog count 16 → 18; update the
  count test.
- Tighten the canonical-query-2 test ("short and curly") to assert the top
  result is now literally short+curly.

### 2. Allowed new dependencies (exactly these, latest versions compatible with SDK 57)

- `@shopify/react-native-skia` (bundled in Expo Go)
- `expo-image-picker`
- `expo-image-manipulator`

Install with `npx expo install` so versions match the SDK. Nothing else.

### 3. Segmentation interface — `src/segmentation/`

**`src/segmentation/types.ts`**:

```ts
export interface HairMask {
  width: number;            // mask resolution (may be smaller than photo)
  height: number;
  data: Float32Array;       // row-major, length = width*height, values 0..1
}
export interface HairSegmenter {
  readonly name: string;
  segment(imageWidth: number, imageHeight: number, pixels: Uint8Array | null): Promise<HairMask>;
}
```

(`pixels` nullable because the mock ignores them; the real tflite segmenter in
M4 will need them. RGBA byte order, row-major.)

**`src/segmentation/mock.ts`** — `MockHairSegmenter`:

- Returns a mask at max 256px on the long side (preserving aspect).
- Shape: a soft "hair cap" — an ellipse centered at (0.5w, 0.38h), radii
  (0.34w, 0.30h), value 1 inside, falling smoothly (smoothstep) to 0 over an
  edge band of ~0.08w; additionally carve out a smaller face ellipse centered
  (0.5w, 0.48h), radii (0.20w, 0.22h) where the mask is multiplied down to
  ≤0.15 (hairline should survive above the face, cheeks should not recolor).
  Deterministic, no randomness.

**Tests — `src/segmentation/__tests__/mock.test.ts`**: dimensions/aspect,
all values within 0..1, center-top of hair band ≈1, image corners ≈0, face
center ≤0.15, symmetry about the vertical axis, determinism (two calls equal).

### 4. CPU image recolor — `src/color/recolorImage.ts`

```ts
export function recolorImage(
  rgba: Uint8Array,            // w*h*4, straight alpha, RGBA
  width: number, height: number,
  mask: HairMask,              // may be lower-res; sample nearest-neighbor
  params: RecolorParams
): Uint8Array;                 // new buffer, same dims
```

- Reuses `recolorPixel` per pixel with `confidence = maskSample`.
- Skip work when maskSample < 0.01 (copy pixel through).
- Performance: build a per-iteration memo keyed on quantized input color
  (e.g. 5-bit/channel key → output) — hair regions have few distinct colors,
  this typically cuts Lab conversions by >90%. Keep it simple (a `Map`).
- Tests (`src/color/__tests__/recolorImage.test.ts`): synthetic 8×8 image —
  mask=0 region byte-identical to input; mask=1 region equals direct
  `recolorPixel` output; alpha channel untouched; nearest-neighbor sampling
  exercised with a 4×4 mask on the 8×8 image; memo path returns identical
  results to non-memo path (test both by recoloring an image with repeated
  colors and comparing against per-pixel recolorPixel).

### 5. Preview screen — `src/ui/PreviewScreen.tsx`

Flow:

1. "Pick a photo" button → `expo-image-picker` (media library; also offer
   camera if permission granted — both behind one small chooser).
2. Downscale via `expo-image-manipulator` to max 768px long side (JPEG).
3. Decode to pixels **with Skia**: `Skia.Data.fromURI` →
   `Skia.Image.MakeImageFromEncoded` → `readPixels()` (RGBA_8888). No other
   decoding path.
4. Run `MockHairSegmenter` → `recolorImage` with the selected catalog color →
   `Skia.Image` from the recolored pixels (`Skia.Image.MakeImage` with
   matching ImageInfo) → draw original and recolored side-by-side-toggleable
   (a "before/after" press-and-hold: show original while pressed).
5. Controls: horizontal swatch row (reuse the swatch look from SearchScreen;
   selecting a color re-runs recolor), and intensity presets — three buttons
   `Subtle 0.5 / Natural 0.8 / Bold 1.0` (no slider dependency).
6. Recolor runs are async (wrap the pixel loop in `await new Promise(r =>
   setTimeout(r,0))` chunks every ~50k pixels so JS thread isn't frozen);
   show a simple "Processing…" state; ignore stale results if the user
   switches colors mid-run (token/sequence check).

**App shell**: replace App.tsx's direct SearchScreen render with a minimal
two-tab switcher (plain Pressables in a bottom bar: "Search" / "Preview") —
still no navigation library. Selecting a hairstyle in Search does nothing new
yet (M6 wires styles); selecting a *color swatch* in Search should switch to
Preview with that color preselected (lift selected-color state into App.tsx).

### 6. UI smoke tests

- `src/ui/__tests__/` — with `@testing-library/react-native` (add as
  dev-dependency; it works with jest-expo): render App, assert both tabs
  render and switching tabs shows PreviewScreen's "Pick a photo" button.
  Mock `expo-image-picker`/`expo-image-manipulator`/Skia modules minimally
  (jest module mocks) — do NOT attempt to exercise real Skia in Jest; the
  pixel pipeline is already covered by pure-function tests.

### 7. Verification (mandatory before writing SUMMARY.md)

```
npm run typecheck   # clean
npm run lint        # 0 errors, 0 warnings
npm test            # all suites pass
npx expo export --platform android   # bundles cleanly with Skia + pickers
```

If `@shopify/react-native-skia` breaks the Metro/export step in any way,
STOP, do not work around it with hacks — document precisely what failed in
SUMMARY.md and mark the iteration blocked (this is decision-relevant for the
planner: it would mean Skia must move behind a dev build, changing D3).

### 8. Commit

Stage everything including the previous `docs/SUMMARY.md` state, one commit:
`Iteration 3: still-photo preview, mock segmentation, Skia pipeline`.
Then overwrite `docs/SUMMARY.md` with the Iteration-3 report (left
uncommitted), same five sections as before.

## Hard constraints

- Do not edit `docs/HANDOFF.md`, `docs/PROGRESS.md`, or `.claude/`.
- No `expo prebuild`; only the three runtime deps listed (plus
  `@testing-library/react-native` as dev-dep).
- No network calls at runtime; no analytics.
- Do not push, do not create a GitHub repo, do not install an emulator.
