# ART.md — Hairstyle overlay art provenance (Iteration 5R / M6 remediation)

Iteration 5's self-authored SVG hairstyle art was rejected on planner visual
review (see `docs/PROGRESS.md`'s Iteration 5 entry): it rendered as
non-hair-like blobs that partially occluded the face. Iteration 5R replaces
that technique entirely with **real hair cut from licensed donor
portraits**, segmented by the app's own on-device pipeline
(`selfie_multiclass_256x256.tflite` → `segmentBoth` → `computeCutout`, see
`src/overlays/extractCutout.ts`).

## Outcome: 1 of 6 MVP styles shipped

Only **`pixie-crop`** shipped a real donor-hair overlay this iteration.
Every other candidate — the donor originally staged for `buzz-cut`, plus
every replacement candidate tried for `classic-bob`, `classic-lob`,
`long-beach-waves`, and `curly-shag` — was rejected. Per
`docs/HANDOFF.md`: *"never lower the licensing or geometry bar."* None was
lowered; the gap is reported here instead.

---

## SHIPPED: `pixie-crop`

- **Asset:** `assets/hairstyles/pixie-crop/front.png` (674×959, 1,032,101
  bytes, SHA-256 `147da40...820`)
- **Donor source:** downloaded and approved in a prior executor session
  whose transcript was lost to a host-machine crash before this session
  began (see `docs/PROGRESS.md`'s Iteration 4R-6 "process note" for the
  established pattern of lost sessions on this project). This session
  inherited the donor file (`donors/pixie-crop.jpg`, gitignored,
  SHA-256 `9045c8f...9eac`, 487,719 bytes) and the state summary "6
  approved originals downloaded... pixie-crop USABLE" from the handoff
  context, but the original source URL was not preserved in any committed
  doc and could not be reconstructed by that session.
  **PROVENANCE RESTORED (planner, 2026-07-12):** the source survives in
  the main session's approval record from the first Iteration 5R executor
  request and was re-verified against Wikimedia Commons on 2026-07-12:
  [File:Pixie Cut (Unsplash).jpg](https://commons.wikimedia.org/wiki/File:Pixie_Cut_(Unsplash).jpg),
  author Janko Ferlič, **CC0 1.0** (Unsplash upload predating the
  2017-06-05 license change), original 4912×4912, anonymous model (no
  personal identification in the file description). This matches the
  inherited donor file's content (professional studio beauty shot, plain
  dark background), and the download of exactly this file was
  user-approved on 2026-07-12 in the main session. License bar met;
  asset cleared for release builds.
- **Extraction result (on-device, this session, re-run against current
  `extractCutout.ts` at commit `df9243c` to get fresh, consistent
  numbers):**
  ```
  hair fraction: 0.1508
  cutout: 674x959
  faceBox (cutout-normalized): x=0.0282 y=0.2294 w=0.9436 h=0.7508
  hairCoverageInFaceBox: 0.1657   (gate: < 0.20 — PASS)
  ```
  Face-box anchor visually verified (drawn as an overlay rectangle on the
  cutout and inspected) to sit correctly on the donor's actual face, not a
  mis-detected region — see the `classic-lob` rejection below for why this
  check matters.
- **Catalog wiring:** `src/catalog/data/hairstyles.json`'s `pixie-crop`
  entry has `assets.front` = the PNG above and `assets.headBox` = the
  `faceBox` above (donor-space normalized coords, consumed by
  `computeUniformPlacementFromFaceMask`). `src/overlays/registry.ts`
  carries the same numbers as `OVERLAY_REGISTRY['pixie-crop']`.
- **Shipped-asset gate:** `src/overlays/__tests__/shippedAssetOcclusion.test.ts`
  independently re-decodes `front.png` via `pngjs` (not the app's own Skia
  path) and re-computes the same coverage fraction against the shipped
  file on disk — a future asset swap that skips re-running the extraction
  pipeline's occlusion check fails this test automatically.
- **Round-2 gate recalibration (2026-07-12): re-confirmed PASS under the
  revised gate.** The numbers above predate the round-2 gate revision (the
  original flat `hairCoverageInFaceBox < 0.20` rule). Under the revised
  gate (`docs/HANDOFF.md` ROUND 2 ADDENDUM — inner-face `< 0.15`,
  whole-face backstop `< 0.5`, face-box plausibility with the width-fraction
  cap raised 0.60 → 0.70): `innerFaceCoverage = 0.0722` (PASS),
  `hairCoverageInFaceBox = 0.1647` (PASS, well under the 0.5 backstop),
  donor face-box width fraction `0.621` — inside the recalibrated
  `[0.15, 0.70]` bound (PASS; this is the exact finding that motivated the
  cap being raised from 0.60), aspect `0.879` and top-edge `y=0.215` both
  comfortably inside bounds. **`gatePass: true`** under the revised gate,
  in addition to the pre-existing visual anchor-box verification above.
  `shippedAssetOcclusion.test.ts` was updated in Iteration 5R round 2 to
  assert the revised inner-face/whole-face thresholds directly against
  this shipped asset (plausibility isn't re-derivable from the shipped PNG
  alone — see that test file's header comment — so it stays a one-time
  extraction-time + visual check, not a CI regression gate).

---

## REJECTED (critical): `buzz-cut` donor — personality-rights problem

The donor file inherited as `donors/buzz-cut.jpg` (from the same lost prior
session) was **not** a generic licensed stock photo. On visual inspection
this session, it is an official U.S. military public-affairs portrait,
captioned in-frame: *"The Basic School Executive Officer — Lieutenant
Colonel Matt T. Mowery"* (U.S. Marine Corps dress uniform, flags, unit
insignia, decorative border).

The on-device extraction pipeline ran on it without any technical error —
`selfie_multiclass_256x256.tflite` correctly isolated his short hair from
the uniform/flags/text/border (none of which are classified as hair or
face-skin), producing a clean-looking cutout (315×391,
`hairCoverageInFaceBox` = 0.1054, well under the 0.20 gate) that would have
passed every machine check. **This is exactly why the machine gate alone
is not sufficient and why this needed a human/visual review pass**, per
the lesson already recorded in `docs/PROGRESS.md`'s Iteration 5 entry
("flows passed" ≠ "looks right") — here extended from "does it look like
hair" to "is this actually a licensed, appropriate donor at all."

Regardless of the image's copyright status (U.S. government works are
often public domain under 17 U.S.C. § 105, but this session did not
verify that, and it is a separate question from the one that matters
here), shipping a hair cutout derived from a **specific, named,
identifiable military officer's official portrait** in a commercial
hair-color-try-on app is a personality-rights/publicity-rights problem,
not a copyright-licensing one, and is categorically different from the
generic CC0/Unsplash civilian stock photography the rest of this
iteration's candidate list draws from. It does not belong in this app
under any license.

**Action taken:** `assets/hairstyles/buzz-cut/` deleted, `buzz-cut`
removed from `OVERLAY_REGISTRY`, `assets.headBox` removed from the
catalog's `buzz-cut` entry (reverts to "Art coming soon"), the evidence
screenshot that had this donor's recolored hair composited into it
(`docs/evidence/iter5r-buzz-cut-natural.png`) deleted rather than kept.
`donors/buzz-cut.jpg` remains on disk locally (gitignored, never
committed, never bundled) — **flagging here that the user should verify
where this file originated and delete it from their local machine**; it
did not come from this session's downloads.

**Recommendation for the next buzz-cut donor search:** restrict to
Wikimedia Commons' CC0/Unsplash category (as already used for the other
four styles below) or another source that is unambiguously anonymous
stock photography, and add a quick "does this look like a specific named
individual in an institutional/official context, not a stock photo" visual
check as a standing step before any donor is extracted, not just before
shipping.

---

## REJECTED: `classic-bob`, `classic-lob`, `long-beach-waves`, `curly-shag`

For all four, this session tried every viable candidate from the planner's
pre-approved Wikimedia Commons CC0/Unsplash list (see `docs/HANDOFF.md`'s
candidate list) — no substitutions outside that list were downloaded.
Thumbnails (~640px, Special:FilePath) were fetched for visual triage first
(13 of the 17 listed candidates; the remaining 4 — "Love 2", "Music and
cats", "Štefan Štefančík 2017-02-07", "36 (Unsplash)", "Woman looking at
greenhouse" — were independently confirmed not front-facing / two-person /
explicitly "no face" tagged before any download, so were skipped), then
promoted to ~1600px full-resolution downloads for on-device extraction
testing. All thumbnails and full-resolution intermediates were deleted
from the scratchpad after triage; nothing beyond the two shipped/rejected
assets above was kept.

**Occlusion gate: `hairCoverageInFaceBox` must be < 0.20.**

| Style | Candidate | Result | Notes |
|---|---|---|---|
| classic-bob | "Smiling cross-legged on road" | **0.4311 — FAIL** | Full-body seated shot; hair falls forward past both shoulders in the source photo |
| classic-bob | "Averie woodard 2016-07-18 (Unsplash_yJg3c6xHMjg)" (balloon photo) | **0.2166 — FAIL** (also cutout only 98×122px — unusably low resolution even had it passed) | Subject small/distant in frame |
| classic-bob | "Minsk, Belarus (Unsplash_1ejZ2XBjJgU)" | Rejected pre-extraction | Extreme close-up crop; crown/top of head not in frame at all |
| classic-bob | "Music and cats", "Štefan Štefančík 2017-02-07", "36 (Unsplash)", "Woman looking at greenhouse" | Rejected pre-extraction | Not front-facing / subject shown from behind / two people in frame / explicitly "no face photos" tagged on Commons |
| classic-lob | "Woman in front of window" | **0.3693 — FAIL** | Clean front-facing portrait but hair drapes across both sides of the face with only a narrow center part |
| classic-lob | "Model Features" | Numeric 0.0000 (would PASS) but **REJECTED** — face-box detection verified wrong | The face-skin mask locked onto the subject's bare shoulder (also skin-toned), not her face; confirmed by rendering the alpha channel and overlaying the recorded face-box rectangle on the color cutout — the box sits over the shoulder/background, not the face. A "passing" number from a wrong anchor is worse than an honest failure, so this was not shipped. |
| classic-lob | "Camila Cordeiro 2015-08-25" | Rejected pre-extraction | Photo shows the subject facing away from the camera in a field, not a front-facing portrait |
| long-beach-waves | "Blowing a kiss" | **0.2219 — FAIL** (closest miss of all candidates) | Clean front-facing portrait; hair strand crosses in front of one cheek |
| long-beach-waves | "Woman in a field" | **0.4641 — FAIL** | Windswept hair, very low hair-fraction detected (0.79%), poor segmentation on this particular lighting/motion |
| long-beach-waves | "Going down the river" | Rejected pre-extraction | Two people in frame; subject's crown covered by a large woven hat |
| long-beach-waves | "Woman-big-tree-spring" | Rejected pre-extraction | Subject too small/distant in frame (full landscape shot) |
| curly-shag | "Confident Eye Contact" | **0.3833 — FAIL** | Clean front-facing portrait; curly hair drapes heavily over one side of the face |
| curly-shag | "Happy" | **0.4442 — FAIL** | Three-quarter turned pose, hair falls across the near side of the face |

**Pattern observed:** styles with visible hair length past the ears
(lob/waves/shag) are structurally harder to satisfy the occlusion gate
with front-facing real photography, because natural hair drape/framing
strands crossing in front of the face read as "hair over the donor's own
face" even in otherwise well-composed portraits — the same property that
makes a hairstyle look natural on its original wearer works against the
donor-extraction technique's face-occlusion heuristic. Very short/cropped
styles (pixie, buzz) don't have this problem because short hair
structurally can't drape across the face. This is a real finding for the
next iteration's approach, not a testing gap: every approved candidate for
all four remaining styles was tried.

**Recommendation for a future iteration:** either (a) accept a higher
occlusion threshold specifically for longer styles with a compensating
placement-time face-hole check instead of a flat 20% cutoff, (b) search
specifically for donor photos with hair pulled behind the ears/shoulders
(explicitly excluding "hair-framing-face" compositions), or (c) revisit
whether the early-read occlusion metric (measured on the donor's own
photo) is the right proxy at all versus a metric computed after placement
onto a representative target face.

---

## Extraction protocol (for reproducing or extending this record)

1. Candidate portraits are resized on-device to ≤1024px on the long side
   (`MAX_DONOR_DIMENSION` in the extraction harness), run through
   `TfliteHairSegmenter.segmentBoth` (real `selfie_multiclass_256x256.tflite`
   inference — hair channel 1, face-skin channel 3).
2. `computeCutout` (`src/overlays/extractCutout.ts`): keeps only the
   largest connected hair region (`keepLargestRegion`), feathers its edge
   (`blurMask`, radius 2), builds a donor-resolution alpha channel, crops
   to the hair bounding box unioned with the detected face box, and
   records the face box in cutout-relative normalized coordinates plus an
   early `hairCoverageInFaceBox` read.
3. The one-time on-device dev harness that drives this (`runDonorExtraction`
   in a since-deleted `src/ui/devDonorExtract.ts`) is **never committed**
   by design — it requires the gitignored `donors/` folder, so committing
   it would break a clean checkout and the EAS build (which respects
   `.gitignore`). It is rebuilt from this description whenever the next
   iteration needs to extract a new donor; see git history (commits
   `9570557`, `df9243c`, and this iteration's commits) for the reproducible
   `extractCutout.ts` math, which **is** committed and unit-tested.
4. PNGs + `anchors.json` are pulled off-device via
   `adb exec-out run-as com.maneframe.app cat files/donor-extract/<file>`
   (plain `adb pull` mishandles the app-private storage path on this
   Windows/git-bash setup; `exec-out` streams the file through `run-as`
   correctly for both text and binary).
