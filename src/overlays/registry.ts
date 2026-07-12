/**
 * Registry of shipped hairstyle-overlay art (Iteration 5R / M6 remediation).
 * Each entry is a REAL hair cutout extracted from a licensed donor portrait
 * via the app's own segmentation pipeline (see `src/overlays/extractCutout.ts`
 * and `docs/ART.md` for provenance + the extraction protocol), keyed by the
 * catalog's `Hairstyle.id`. The self-authored SVG art from Iteration 5 was
 * rejected on planner visual review (see docs/PROGRESS.md) and is retired —
 * do not reintroduce it.
 *
 * Pure data (the `module` field is a Metro asset id, not a live Skia
 * object), so this stays safe to import from the catalog's integrity tests
 * without pulling in native rendering code. Decoding the raster into actual
 * pixels happens on-device via `decodeOverlayAsset` (`src/overlays/rasterize.ts`).
 *
 * A hairstyle is "art-bearing" (eligible for try-on) exactly when its id
 * appears here AND its catalog entry has an `assets.headBox` anchor (see
 * `src/catalog/__tests__/catalog.test.ts`'s cross-check test, which keeps
 * these two sources of truth from drifting apart). `headBox` here is the
 * DONOR's own detected face box, in cutout-relative normalized (0..1)
 * coordinates — semantically a face box, not a head box, for raster cutout
 * assets (see `computeUniformOverlayTransform` in `src/placement/headBox.ts`).
 *
 * Iteration 5R round 1 shipped only pixie-crop; round 2's bounded search
 * (revised occlusion gate: inner-face < 0.15, whole-face < 0.5 backstop,
 * face-box plausibility — see `src/overlays/extractCutout.ts`) added
 * classic-lob, curly-shag, and long-beach-waves from new user-approved
 * CC0 donors. `classic-bob` (no candidate passed the gate in either
 * round) and `buzz-cut` (round 1's staged donor was an official U.S.
 * military portrait of a named, identifiable officer — a
 * personality-rights problem — and round 2 found no anonymous CC0
 * replacement with visible buzz-cut-length hair) ship as catalog gaps
 * ("Art coming soon"). See docs/ART.md for the full
 * candidate-by-candidate record.
 */

export interface OverlayAsset {
  /** require() module id for the bundled raster hair cutout (PNG). */
  module: number;
  /** Intrinsic pixel size of the raster asset. */
  width: number;
  height: number;
  /** Donor's face box, normalized (0..1), in the raster's own coordinate space. */
  headBox: { x: number; y: number; w: number; h: number };
}

function asset(module: number, width: number, height: number, headBox: OverlayAsset['headBox']): OverlayAsset {
  return { module, width, height, headBox };
}

export const OVERLAY_REGISTRY: Readonly<Record<string, OverlayAsset>> = Object.freeze({
  'pixie-crop': asset(
    require('../../assets/hairstyles/pixie-crop/front.png'),
    674,
    959,
    { x: 0.028189910979228485, y: 0.22940563086548488, w: 0.9436201780415431, h: 0.7507820646506778 }
  ),
  'classic-lob': asset(
    require('../../assets/hairstyles/classic-lob/front.png'),
    722,
    641,
    { x: 0.16620498614958448, y: 0.2896048654446178, w: 0.47645429362880887, h: 0.5514394013260531 }
  ),
  'curly-shag': asset(
    require('../../assets/hairstyles/curly-shag/front.png'),
    381,
    433,
    { x: 0.3685818569553806, y: 0.2678983833718245, w: 0.3915682414698163, h: 0.5080831408775982 }
  ),
  'long-beach-waves': asset(
    require('../../assets/hairstyles/long-beach-waves/front.png'),
    565,
    506,
    { x: 0.07610619469026549, y: 0.10458868577075099, w: 0.2973451327433628, h: 0.3843410326086957 }
  ),
});

export function getOverlayAsset(styleId: string): OverlayAsset | null {
  return OVERLAY_REGISTRY[styleId] ?? null;
}

export function hasOverlayArt(styleId: string): boolean {
  return styleId in OVERLAY_REGISTRY;
}
