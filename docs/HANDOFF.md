# HANDOFF — Iteration 5R (M6 remediation: real-hair donor overlays)

**Author:** Fable 5 (planner) · **Status: READY (pending user approval of donor-photo downloads — the main session will relay it)**

## What stands, what's rejected

Iteration 5's engineering is ACCEPTED and stays: placement engine,
`segmentBoth`, overlay recolor pipeline, Preview/Search wiring, hints,
dev flows, tests. The six self-authored SVG overlays are REJECTED on
planner visual review: they render as blobs/bars that don't read as hair
and partially occlude the face (see docs/evidence/iter5-style-*.png), and
non-uniform scaling stretches them. Do not iterate on the SVG art — the
technique is retired.

## New approach: donor-hair extraction (use the pipeline we already trust)

For each style, cut REAL hair out of a properly licensed donor portrait
using our own segmentation, and ship the cutout as the overlay:

1. **Donor photos.** 6 front-facing CC0 / public-domain portraits, one
   per catalog style id (pixie-crop, buzz-cut, classic-bob, classic-lob,
   long-beach-waves, curly-shag), hair fully inside the frame, decent
   resolution (≥800px face). Wikimedia Commons / other PD-CC0 sources.
   Record source URL + license per donor in a new docs/ART.md.
   **Downloads require user approval — before fetching anything, send the
   main session the full list (per file: style id, URL, license, approx
   size) and wait.** If a style has no acceptable donor, report the gap
   rather than lowering the licensing or quality bar.
2. **Extraction (on-device, one-time).** Host can't run TFLite (disk
   budget), but the phone can: extend the __DEV__ diagnostics with an
   "extract donor assets" action that, for each bundled donor image,
   runs `segmentBoth`, computes the hair cutout (RGBA: donor pixels ×
   feathered hair-alpha; feather = small blur on the mask edge, pick
   radius by eye), crops to the hair bounding box, and records the
   donor's face box in cutout-relative normalized coords. Save PNGs +
   a JSON of anchors to app document storage; `adb pull`; convert to
   webp if smaller; commit as `assets/hairstyles/<id>/front.webp` +
   catalog `headBox` anchors. The donor originals do NOT ship in the
   app binary — only the cutouts (keep the originals in a gitignored
   local folder; ART.md records their provenance).
3. **Placement changes.** UNIFORM scale only: scale = target face-box
   width / donor face-box width; anchor by aligning the two face boxes'
   top-centers. Drop the non-uniform stretch path entirely. Keep nudge
   controls and edge clamping.
4. **Machine gate for face occlusion.** Unit test over every shipped
   overlay: place it on a synthetic face box per its anchors and assert
   overlay alpha coverage inside the face box is < 20%. This encodes
   "hair must not sit on the face" so no future art regression passes
   CI silently.
5. **Quality pass on the recolor interaction.** Donor cutouts have real
   luminance, so the existing Lab recolor should look natural — verify
   teal-bold and a natural shade on the bundled portrait per style.
6. **Evidence for planner review — BEFORE any EAS build.** All six
   styles on the bundled test portrait (iter5r- prefix), one teal-bold,
   one natural-shade, the no-face hint, and one style on a bald/no-hair
   subject if you can produce one via the camera path pointed at the
   no-face test image swapped for... skip if impractical; note it.
   STOP after committing evidence and ask the main session for planner
   review sign-off.
7. **Only after sign-off:** cancel the hung EAS build
   `80a980d7-229c-405e-8dde-7668068e904e` (`eas build:cancel`) — it may
   block the queue — then submit the ONE preview build, request
   download+install approval, full `npm run e2e`, SUMMARY.md
   "Iteration 5R" section.

## Constraints (unchanged from Iteration 5 unless noted)

- JS/asset-only; dev client 32841af6 remains the iteration vehicle.
- Never edit HANDOFF/PROGRESS/REMEDIATION/.claude; never browse the
  phone's photo library; APK downloads need main-session approval with
  file/source/size; delete APKs after install; disk ~3 GB free — donor
  photos are small but clean up intermediates; commit incrementally
  ("Iteration 5R:" prefix); npm test + tsc + eslint + dev flows green
  before requesting review.
- EAS: build #10 hung (does not produce an artifact); after cancel, the
  resubmit becomes #11 of 15 — approved by planner as within budget
  (floor relaxed to ≥4 remaining for this remediation).
