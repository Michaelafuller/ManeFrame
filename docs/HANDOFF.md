# HANDOFF — Iteration 5 (Milestone M5: live camera recoloring)

**Author:** Fable 5 (planner) · **Status: BLOCKED — awaiting user manual checks (Iteration 4R closed the launch crash; E2E is green)**

## Gate

Iterations 4R through 4R-5 are accepted: the app launches, insets are
correct, the model loads in release builds, and **real hair segmentation
runs on-device** (selfie_multiclass, hair = channel 1) — preview build
`d5998560` is installed on the user's phone, 4/4 Maestro flows green.

Remaining gate before M5: the user's visual quality check on their own
portrait photos (recolor tracks hair not face; edge quality; Mock↔TFLite
toggle comparison; rough latency — CPU baseline is ~2–3s). Depending on
findings, a short polish iteration (mask threshold/feathering, GPU delegate
experiment) may precede M5.

Notes for when this iteration starts: dev client `32841af6` is CURRENT
(safe-area-context included; model swaps are asset-only). M5's native deps
(vision-camera, worklets) require a new development build — build it
alongside the first M5 EAS build (7 of 15 monthly builds remain). The
standing privacy rule from PROGRESS.md applies to all M5 automation:
camera-capture only, never the photo library.

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
