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
 * Iteration 5R shipped only 1 of the 6 MVP styles. Every other candidate
 * (the geometry-passing donor originally staged as `buzz-cut`, plus every
 * replacement candidate tried for classic-bob/classic-lob/long-beach-waves/
 * curly-shag from the planner's pre-approved Wikimedia Commons CC0/Unsplash
 * list) was rejected — `buzz-cut`'s staged donor turned out on inspection
 * to be an official U.S. military portrait of a named, identifiable officer
 * (not a generic CC0 stock photo; a personality-rights problem independent
 * of copyright licensing) and was pulled before shipping; the other four
 * failed the face-occlusion gate or had an unreliable face-box detection.
 * See docs/ART.md for the full candidate-by-candidate record.
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
});

export function getOverlayAsset(styleId: string): OverlayAsset | null {
  return OVERLAY_REGISTRY[styleId] ?? null;
}

export function hasOverlayArt(styleId: string): boolean {
  return styleId in OVERLAY_REGISTRY;
}
