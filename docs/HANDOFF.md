# HANDOFF — Iteration 5 (Milestone M6: hairstyle overlay try-on, MVP)

**Author:** Fable 5 (planner) · **Status: READY**

## Why this is next

User accepted Phase 1 (color engine works on both capture paths). User
decision 2026-07-11: M6 (style overlays) jumps ahead of M5 (live camera)
— style try-on is their primary use case, and note the primary user is
bald: the overlay must look right on a hairless head (which is actually
the clean case — no existing hair to fight), and "no hair detected" must
never read as an error.

## Ground truth you must know

- The catalog (`src/catalog/data/hairstyles.json`) references
  `assets/hairstyles/**.webp` — **none of these files exist**. Art is the
  critical path.
- Segmentation gives more than hair: `selfie_multiclass` channel 3 is
  **face-skin** — use it for head detection/placement. Channel 1 = hair,
  0 = background. The tensor pipeline (`tensorToHairMask`) currently
  extracts only one channel; you will need a second mask (face) — extend
  shape-driven, keep pure-TS + unit-tested.
- JS-only constraint this iteration: NO new native dependencies (dev
  client `32841af6` must stay valid; no gesture-handler — use button
  nudge controls instead). Budget: exactly 1 EAS preview build at the
  end (6 of 15 remain; leave ≥5).

## Work order

1. **Overlay art (self-authored, stylized).** Author a starter set of 6
   styles as in-repo SVG (or Skia-drawable path data): pixie, buzz, bob,
   shoulder-straight, long-wavy, curly — matching existing catalog ids.
   Design constraints:
   - Front-facing, neutral brown luminance ramp (mid-L with believable
     shading structure) so the EXISTING color engine can recolor it:
     treat overlay alpha as the confidence input to `recolorPixel`.
   - Each asset carries anchor metadata: a normalized `headBox`
     (`{x,y,w,h}` in overlay coordinates) marking where the wearer's
     face-skin region should sit under it.
   - Consistent art style across all 6 beats photo-real mismatch. We own
     the copyright; no external art downloads, no AI-generation services.
   - Catalog: point the 6 entries' `assets.front` at the real files;
     styles without art yet must be filtered out of try-on (still
     searchable, marked "art coming soon" on the card).
2. **Placement engine (pure TS, unit-tested).** From the face-skin mask:
   bounding box (threshold 0.5, largest connected region is fine —
   simple flood fill), expand to a head box (scalp extends above the
   face box ~40–60% of its height), then compute the affine transform
   mapping the overlay's `headBox` onto it. Handle: no face detected
   (return null → UI hint "No face detected — try a front-facing
   photo"), off-center faces, and faces near frame edges (clamp).
3. **Preview UI.** Style chip row (from catalog, art-bearing styles
   only) + "None". Selected style renders as a Skia image layer over the
   photo at the computed transform, recolored by the active color and
   intensity through the same Lab pipeline. Nudge controls (dp buttons:
   move/scale, plus reset) for manual correction — keep them minimal.
   Search screen: tapping a style card carries the style (and color, as
   today) into Preview.
4. **"No hair detected" hint (backlog item, release-visible).** When no
   style is selected AND the hair mask's fraction>0.5 is < 0.5%, show a
   neutral hint: "No hair detected in this photo — pick a style to try
   one on." (On this user's selfies that's the normal path, and it now
   advertises the new feature instead of looking broken.)
5. **Tests + E2E.** Unit: mask→face-box, transform math, catalog
   integrity (art-bearing styles have anchors; files exist). Maestro:
   extend the dev flows — bundled portrait + style applied + recolored
   (assert an on-screen dev stat, e.g. overlay box "style: bob @
   x,y,w,h", plus screenshot); camera desk-photo path must show the
   no-face hint rather than an error. Full `flows/` set must stay green.
6. **Evidence + build.** Screenshots: each of the 6 styles rendered on
   the bundled portrait (one grid or six shots), one recolored variant,
   and the no-face hint. Then ONE preview EAS build, install on the
   user's phone (adb install of your own EAS artifact — ask the main
   session for download approval first, listing file/source/size), run
   full e2e against it. SUMMARY.md report as usual.

## Known limitation to document (not solve)

Subjects with existing long hair will have real hair sticking out from
under shorter overlay styles. Out of scope (inpainting territory). Note
it in SUMMARY and the app hint text if a style is much smaller than the
detected hair region. The primary user's bald case is unaffected.

## Backlog (do NOT do this iteration)

- Camera-capture UX polish (user: "leaves a little to be desired" —
  lighting/highlight quality gap vs library photos; likely needs capture
  resolution/exposure work).
- Pinch/rotate gestures (needs gesture-handler → native dep → bundle
  with M5's dev-client rebuild).
- M5 live camera (next after this; see PROGRESS for the
  temporal-smoothing note — selfie_multiclass has no mask-feedback input
  channel, use output-side EMA).

## Standing constraints (unchanged)

- Loop protocol per docs/PROGRESS.md; executor never edits HANDOFF /
  PROGRESS / REMEDIATION / .claude/. Report → docs/SUMMARY.md
  ("Iteration 5" section).
- Automation never opens/browses the photo library. Bundled portrait +
  camera captures only.
- D1–D7; no hand-written native code; no push/analytics/runtime network
  calls; no Expo credentials beyond `eas whoami` / `eas build`.
- Host disk ~2.9 GB free: no heavy installs; delete APKs after install.
