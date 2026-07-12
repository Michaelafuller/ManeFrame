# HANDOFF — next iteration (pending user retest after 4R-6)

**Author:** Fable 5 (planner) · **Status: BLOCKED — awaiting user retest on preview build `1eac9823`**

## Gate

Iteration 4R-6 is accepted. Its verdict: **the segmentation pipeline was
already correct** — all three planner hypotheses (input normalization,
double-softmax, ArrayBuffer input) were empirically refuted by on-device
tensor stats, and on the bundled CC0 portrait the recolor works visibly and
dramatically (hair px 11.04%, teal-bold evidence in docs/evidence/4r6-*).
The user's "no visible change" therefore means the model found ~no hair in
the user's specific photos (control run: no-hair frame → fraction>0.5 =
0.0000, max confidence 0.1049).

The user is retesting on preview build `1eac9823` (installed on their
phone). The retest should distinguish:

- **Library pick of an existing portrait** — if this still yields no
  change, prime suspect is EXIF orientation: library photos carry
  orientation metadata; if expo-image-manipulator's resize does not bake
  it in, Skia's decode (which ignores EXIF) hands the model a sideways
  face, which plausibly segments to nothing. NEXT ITERATION MUST VERIFY
  the orientation of what actually reaches the model (log decoded
  width/height + a downscaled debug dump) before touching anything else.
- **Fresh in-app camera selfie** — camera-path capture may behave
  differently from library picks (different EXIF handling). If camera
  works but library doesn't, EXIF is all but confirmed.
- **Hair characteristics** — if both paths fail on the user's hair but the
  bundled portrait works, the model may struggle with this specific hair
  (very short, gray, low contrast against background, hat, lighting).
  Then the fix is expectation-setting UX, not tensors.

## Known UX gap to fix next iteration regardless of retest outcome

Release builds give NO feedback when the mask is empty — "model found no
hair" is indistinguishable from "broken" (exactly what burned the user in
4R-5/4R-6). Add a release-visible hint when the mask's fraction>0.5 is
below ~0.5%: e.g. "No hair detected in this photo — try a closer, well-lit
shot." Costs one JS-only preview build (6 of 15 monthly builds remain).

## After the gate clears: M5 (live camera) outline unchanged

- react-native-vision-camera + worklets + Skia frame processor; needs a
  new dev-client build (native deps).
- Note: selfie_multiclass has NO previous-mask input channel (that was the
  old 4-channel hair_segmenter, now removed) — the M5 temporal-smoothing
  design must use output-side mask smoothing (EMA between frames), not the
  4th-input-channel mechanism from the original Iteration 4 notes.
- Recolor moves to an SkSL shader; CPU implementation stays as reference.

## Standing constraints (unchanged)

- Loop protocol per docs/PROGRESS.md; executor never edits HANDOFF /
  PROGRESS / REMEDIATION / .claude/.
- Automation never opens/browses the photo library (bundled-portrait
  diagnostic + flows-dev/04 exist for hair-bearing coverage).
- D1–D7; no hand-written native code without STOP-and-report; no push, no
  analytics, no runtime network calls.
