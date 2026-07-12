# HANDOFF — Iteration 5R (M6 remediation: real-hair donor overlays)

**Author:** Fable 5 (planner) · **Status: ROUND 2 — see addendum at top; original work order below still governs anything it doesn't supersede**

## ROUND 2 ADDENDUM (planner, 2026-07-12, after first review)

Round-1 outcomes, all planner-ratified: pixie-crop SHIPPED and signed
off (provenance restored in ART.md — CC0 verified); buzz-cut donor
pulled for personality-rights (named USMC officer) — pull ENDORSED, the
style needs an ANONYMOUS donor; 4 styles gapped on the occlusion gate.
User decision: one more bounded search round under a revised gate, then
the single EAS build ships whatever has passed.

**Gate revision (replaces the flat <20% whole-face rule):**
- INNER-FACE gate (hard): alpha coverage over the central face region —
  x ∈ [faceBox.x + 0.20·w, faceBox.x + 0.80·w], y ∈ [faceBox.y + 0.15·h,
  faceBox.y + 0.85·h] (the eyes/nose/mouth zone) — must be **< 15%**.
  Face-framing strands over cheek edges/temples are now LEGAL; that's
  what real long styles do.
- WHOLE-FACE backstop (hard): total alpha coverage over the full face
  box **< 50%** (catches iteration-5-style disasters without punishing
  framing).
- FACE-BOX PLAUSIBILITY (hard, fixes the shoulder-lock false pass):
  reject the extraction if the detected face box has aspect w/h outside
  [0.55, 1.15], or width outside [15%, 60%] of image width, or its top
  edge in the bottom third of the image. On rejection, the donor fails
  loudly — never score occlusion against an implausible box.
- The anchor-box-rendered-on-cutout visual check from round 1 stays
  mandatory per shipped style.
Apply the revised gate in BOTH the extraction harness and the
shipped-asset pngjs unit test (update pixie-crop's expectations too — it
must pass the new gate; if it doesn't, tell the planner, don't tune
numbers to fit).

**Round-2 scope (bounded):** one candidate sweep for classic-bob,
classic-lob, long-beach-waves, curly-shag, plus an anonymous buzz-cut
donor. Same licensing bar (CC0/PD, re-verified per file). Same approval
protocol: full thumbnail list → main session → wait; promotions within
the approved list are covered by that same approval. Re-testing the
round-1 rejects that failed ONLY on face-framing strands (classic-lob
"Model Features" excluded — its failure was face-box lock, retest it
under the plausibility rule; long-beach-waves 0.337 and classic-lob
0.419 are worth re-scoring under the inner-face gate before any new
downloads) is FREE — do that first; it may shrink the download list.
If a style still has no passing candidate after this round, it ships as
a gap ("Art coming soon") — no third round this iteration.

**Then:** evidence (iter5r2- prefix, every shipped style, one teal-bold,
one natural) → STOP for planner review → after sign-off: cancel hung EAS
build 80a980d7, submit the ONE preview build, request install approval,
full e2e, SUMMARY.md.

---

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
