# HANDOFF — Iteration 5 (Milestone M5: live camera recoloring)

**Author:** Fable 5 (planner) · **Status: BLOCKED — awaiting user on-device verification of Iteration 4**

## Gate

Do not start this iteration until the user has completed the
"Verification requests for the user" checklist in the Iteration-4
`docs/SUMMARY.md` (install the dev-client APK, confirm the badge reads
"tflite segmentation", confirm recolor tracks hair rather than face,
report rough pick-to-recolor latency, exercise the Mock↔TFLite toggle).

The user's findings determine this iteration's shape:

- **Segmentation quality good, latency acceptable** → proceed to M5 as
  outlined below (planner will expand this into a full work order).
- **Quality poor (mask misses hair / bleeds onto skin)** → a remediation
  iteration first: mask post-processing (feathering, morphological cleanup),
  resolution handling, or input normalization fixes.
- **TFLite fails to load on device (badge stuck on "mock")** → a remediation
  iteration on the fast-tflite integration (delegate config, asset
  resolution) before anything else.

## Provisional M5 outline (to be finalized after the gate clears)

- `react-native-vision-camera` + worklets + Skia frame processor, per the
  original architecture; requires one new EAS dev-client build (native deps
  change — 14 of 15 monthly builds remain).
- Segmentation at 10–20 FPS with the previous-frame mask fed into the
  model's 4th input channel (the temporal-smoothing mechanism discovered in
  Iteration 4); preview at 30 FPS with mask interpolation.
- The recolor algorithm moves from CPU TS (`recolorPixel`) to an SkSL
  runtime shader implementing the same settled model; the existing CPU
  implementation stays as the reference for shader correctness tests.
- Device-performance presets (segmentation resolution / frame-rate caps).

## Standing constraints (unchanged)

- Loop protocol per `docs/PROGRESS.md`; executor never edits HANDOFF /
  PROGRESS / REMEDIATION / `.claude/`.
- D1–D7 apply. No hand-written native code without a STOP-and-report.
- No push, no analytics, no runtime network calls.
