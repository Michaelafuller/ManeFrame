/**
 * Registry of the self-authored SVG hairstyle-overlay art (Iteration 5 /
 * M6), keyed by the catalog's `Hairstyle.id`. Pure data + pure TS — no
 * Skia/React import — so it's safe to unit test directly and to import
 * from `src/catalog`'s integrity tests without pulling in native code.
 *
 * A hairstyle is "art-bearing" (eligible for try-on) exactly when its id
 * appears here AND its catalog entry has an `assets.headBox` anchor (see
 * `src/catalog/__tests__/catalog.test.ts`'s cross-check test, which keeps
 * these two sources of truth from drifting apart).
 */

import { BUZZ_CUT_SVG } from './svg/buzzCut';
import { CLASSIC_BOB_SVG } from './svg/classicBob';
import { CLASSIC_LOB_SVG } from './svg/classicLob';
import { CURLY_SHAG_SVG } from './svg/curlyShag';
import { LONG_BEACH_WAVES_SVG } from './svg/longBeachWaves';
import { PIXIE_CROP_SVG } from './svg/pixieCrop';
import { OVERLAY_HEAD_BOX, OVERLAY_HEIGHT, OVERLAY_WIDTH } from './svg/shared';

export interface OverlayAsset {
  /** Raw SVG markup, ready for `Skia.SVG.MakeFromString`. */
  svg: string;
  /** Intrinsic canvas size the SVG's viewBox and headBox are defined in. */
  width: number;
  height: number;
  /** Normalized (0..1) anchor: where the wearer's face-skin should sit. */
  headBox: { x: number; y: number; w: number; h: number };
}

function asset(svg: string): OverlayAsset {
  return { svg, width: OVERLAY_WIDTH, height: OVERLAY_HEIGHT, headBox: OVERLAY_HEAD_BOX };
}

/**
 * The six MVP styles, matching existing catalog ids exactly (see
 * docs/HANDOFF.md's "pixie, buzz, bob, shoulder-straight, long-wavy,
 * curly" -> mapped onto the closest existing catalog entries).
 */
export const OVERLAY_REGISTRY: Readonly<Record<string, OverlayAsset>> = Object.freeze({
  'pixie-crop': asset(PIXIE_CROP_SVG),
  'buzz-cut': asset(BUZZ_CUT_SVG),
  'classic-bob': asset(CLASSIC_BOB_SVG),
  'classic-lob': asset(CLASSIC_LOB_SVG),
  'long-beach-waves': asset(LONG_BEACH_WAVES_SVG),
  'curly-shag': asset(CURLY_SHAG_SVG),
});

export function getOverlayAsset(styleId: string): OverlayAsset | null {
  return OVERLAY_REGISTRY[styleId] ?? null;
}

export function hasOverlayArt(styleId: string): boolean {
  return styleId in OVERLAY_REGISTRY;
}
