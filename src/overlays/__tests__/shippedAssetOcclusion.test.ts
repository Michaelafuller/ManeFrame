/**
 * Machine gate for face occlusion (Iteration 5R / M6 remediation, revised
 * Iteration 5R round 2): decodes every SHIPPED overlay asset PNG straight
 * off disk (via `pngjs`, not the app's own decode path - a deliberately
 * independent check) and asserts the REVISED gate from `extractCutout.ts`:
 * inner-face coverage (eyes/nose/mouth zone) stays under
 * `INNER_FACE_MAX_COVERAGE`, and whole-face coverage stays under the
 * `WHOLE_FACE_MAX_COVERAGE` backstop. This is the "hair must not sit on the
 * face" invariant the planner ordered after Iteration 5's SVG art shipped
 * with overlays that visually occluded the face despite every other machine
 * check passing (see docs/PROGRESS.md's Iteration 5 entry: "flows passed"
 * != "looks right" - but THIS property, unlike general art quality, is
 * machine-checkable, so it gets a real regression gate).
 *
 * Coverage math is shared with the extraction harness via
 * `computeInnerFaceBox`/`computeAlphaCoverage` (`../extractCutout`) - same
 * functions, same thresholds, independently re-derivable from either the
 * freshly-computed cutout or (here) the shipped PNG on disk. NOT wired here:
 * the face-box PLAUSIBILITY check (aspect/width-fraction/vertical-position),
 * because that check is scale-dependent on the donor's TRUE pre-crop pixel
 * dimensions, which aren't recorded in the shipped registry (only the
 * cutout-relative face box is - see `OverlayAsset`). Plausibility is
 * verified once, at extraction time, by the gitignored `donors/anchors.json`
 * harness output plus the mandatory anchor-box-rendered-on-cutout visual
 * check (docs/HANDOFF.md ROUND 2 ADDENDUM) - not re-derivable from the
 * shipped asset alone, so it stays a one-time human-verified gate rather
 * than a CI regression gate.
 *
 * Reads the actual files under `assets/hairstyles/<id>/front.png`, not a
 * fixture copy - a future iteration that replaces a shipped asset without
 * re-running the extraction pipeline's occlusion check will fail this test
 * automatically.
 */

import * as fs from 'fs';
import * as path from 'path';
import { PNG } from 'pngjs';

import {
  computeAlphaCoverage,
  computeInnerFaceBox,
  INNER_FACE_MAX_COVERAGE,
  WHOLE_FACE_MAX_COVERAGE,
} from '../extractCutout';
import { OVERLAY_REGISTRY } from '../registry';

const ASSETS_ROOT = path.join(__dirname, '..', '..', '..', 'assets', 'hairstyles');

describe('shipped overlay asset face-occlusion gate (pngjs, reads real files)', () => {
  const ids = Object.keys(OVERLAY_REGISTRY);

  it('has at least one shipped asset to gate', () => {
    expect(ids.length).toBeGreaterThan(0);
  });

  for (const id of ids) {
    describe(id, () => {
      const asset = OVERLAY_REGISTRY[id];
      const assetPath = path.join(ASSETS_ROOT, id, 'front.png');

      it('front.png exists on disk', () => {
        expect(fs.existsSync(assetPath)).toBe(true);
      });

      it('decoded dimensions match the registry entry', () => {
        const png = PNG.sync.read(fs.readFileSync(assetPath));
        expect(png.width).toBe(asset.width);
        expect(png.height).toBe(asset.height);
      });

      it(`inner-face (eyes/nose/mouth) alpha coverage stays under ${INNER_FACE_MAX_COVERAGE}`, () => {
        const png = PNG.sync.read(fs.readFileSync(assetPath));
        const innerBox = computeInnerFaceBox(asset.headBox);
        const coverage = computeAlphaCoverage(png.data, png.width, png.height, innerBox);
        expect(coverage).toBeLessThan(INNER_FACE_MAX_COVERAGE);
      });

      it(`whole-face alpha coverage stays under the ${WHOLE_FACE_MAX_COVERAGE} backstop`, () => {
        const png = PNG.sync.read(fs.readFileSync(assetPath));
        const coverage = computeAlphaCoverage(png.data, png.width, png.height, asset.headBox);
        expect(coverage).toBeLessThan(WHOLE_FACE_MAX_COVERAGE);
      });
    });
  }
});
