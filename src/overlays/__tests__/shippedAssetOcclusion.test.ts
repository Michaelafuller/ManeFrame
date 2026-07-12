/**
 * Machine gate for face occlusion (Iteration 5R / M6 remediation): decodes
 * every SHIPPED overlay asset PNG straight off disk (via `pngjs`, not the
 * app's own decode path - a deliberately independent check) and asserts
 * that its alpha coverage inside its own recorded face box stays under
 * 20%. This is the "hair must not sit on the face" invariant the planner
 * ordered after Iteration 5's SVG art shipped with overlays that visually
 * occluded the face despite every other machine check passing (see
 * docs/PROGRESS.md's Iteration 5 entry: "flows passed" != "looks right" -
 * but THIS property, unlike general art quality, is machine-checkable, so
 * it gets a real regression gate).
 *
 * Reads the actual files under `assets/hairstyles/<id>/front.png`, not a
 * fixture copy - a future iteration that replaces a shipped asset without
 * re-running the extraction pipeline's occlusion check will fail this test
 * automatically.
 */

import * as fs from 'fs';
import * as path from 'path';
import { PNG } from 'pngjs';

import { OVERLAY_REGISTRY } from '../registry';

/** Matches `computeCutout`'s own early-read threshold (alpha > 0.1, i.e. > 25/255). */
const ALPHA_COVERED_THRESHOLD = 25;

/** The face-occlusion gate itself: docs/HANDOFF.md Iteration 5R, item 4. */
const MAX_FACE_COVERAGE = 0.2;

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

      it(`alpha coverage inside its own face box stays under ${MAX_FACE_COVERAGE}`, () => {
        const png = PNG.sync.read(fs.readFileSync(assetPath));
        const { x, y, w, h } = asset.headBox;

        const x0 = Math.max(0, Math.floor(x * png.width));
        const y0 = Math.max(0, Math.floor(y * png.height));
        const x1 = Math.min(png.width - 1, Math.ceil((x + w) * png.width) - 1);
        const y1 = Math.min(png.height - 1, Math.ceil((y + h) * png.height) - 1);

        let area = 0;
        let covered = 0;
        for (let yy = y0; yy <= y1; yy++) {
          for (let xx = x0; xx <= x1; xx++) {
            area++;
            const alpha = png.data[(yy * png.width + xx) * 4 + 3];
            if (alpha > ALPHA_COVERED_THRESHOLD) covered++;
          }
        }

        expect(area).toBeGreaterThan(0);
        const coverage = covered / area;
        expect(coverage).toBeLessThan(MAX_FACE_COVERAGE);
      });
    });
  }
});
