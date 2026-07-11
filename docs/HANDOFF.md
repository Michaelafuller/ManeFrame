# HANDOFF — Iteration 4 (Milestone M4: real hair segmentation via fast-tflite, EAS dev build)

**Author:** Fable 5 (planner) · **Executor:** Sonnet 5 · **Status: PRIMED — awaiting user prerequisites**

## Prerequisites the USER must complete before this iteration starts

1. **Create a free Expo account** and run `eas login` once on this machine
   (executor agents must never handle these credentials; they only verify
   login state via `eas whoami`).
2. **Have an Android phone available** to install the dev-client APK via the
   EAS internal-distribution link/QR (needs only the "install unknown apps"
   permission — no USB debugging or adb).

## Context

Iterations 1–3 accepted (`0bbec82`, `20711ee`, `b5baf8e`). Phase 1
(still-photo recoloring with a mock segmenter) is code-complete and Expo
Go-compatible. This iteration replaces the mock with Google's real
hair-segmentation model via `react-native-fast-tflite` (decision D2), which
requires leaving Expo Go for a custom dev client. Per decision D7 (EAS
path), the native build happens on EAS cloud workers — **no local
`expo prebuild`, no local Gradle, no `android/` directory in the repo**.
The free tier allows 15 Android builds/month with a 45-minute timeout;
this iteration should consume exactly one (plus at most one retry).

## Scope

### 1. Model acquisition

- Download Google's MediaPipe hair segmentation model
  (`hair_segmenter.tflite`, Apache-2.0; from the MediaPipe image-segmenter
  documentation's official Google storage URL). Place at
  `assets/models/hair_segmenter.tflite`. Record the exact URL, file size,
  and SHA-256 in SUMMARY.md. If the canonical Google URL is dead, STOP and
  report — do not source the model from an unofficial mirror.

### 2. Dependencies + configuration (Continuous Native Generation only)

- `npx expo install react-native-fast-tflite`.
- `app.json`: add config plugins for `expo-image-picker` and
  `expo-image-manipulator` (permission strings) and `react-native-fast-tflite`
  if it ships one. Set a sensible `android.package` (e.g.
  `com.maneframe.app`) if not already set.
- `metro.config.js`: extend the default Expo config so `tflite` is in
  `assetExts` (create the file; it doesn't exist yet).
- `eas.json`: create with two profiles —
  - `development`: `developmentClient: true`, `distribution: "internal"`
    (produces a sideloadable APK with the dev client).
  - `preview`: `distribution: "internal"`, plain release APK (not used this
    iteration; primed for later).
- Do NOT run `expo prebuild` locally and do NOT commit an `android/`
  directory. If EAS's remote prebuild fails, fix it via app.json/plugins,
  never via manual native edits (report as blocked if plugins can't express
  something).

### 3. Real segmenter — `src/segmentation/tflite.ts`

- `TfliteHairSegmenter implements HairSegmenter`:
  - Lazy singleton model load (`loadTensorflowModel(require('...tflite'))`).
  - Inspect and handle the model's actual I/O: resize the input RGBA pixels
    to the model's expected input dims (bilinear, pure TS, RGB float
    normalization per model requirements), run inference, convert the output
    tensor (confidence map or categorical — determine from the tensor shape
    and document which in SUMMARY.md) into `HairMask` (0..1 Float32Array).
  - On any load/inference failure: throw a typed error; never crash the UI.
- PreviewScreen: default to `TfliteHairSegmenter`; if construction/first
  inference fails, fall back to `MockHairSegmenter` and show a small visible
  "mock segmentation" badge. Add a dev toggle (long-press the badge area or a
  simple switch) to force Mock ↔ TFLite for comparison.
- Unit tests for the pure parts only: bilinear resize (known 2×2→4×4
  values), tensor→mask conversion with synthetic tensors (both plausible
  output layouts), fallback selection logic (with a stubbed failing
  segmenter). Real inference is device-only; do not attempt it in Jest.

### 4. Verification (mandatory before writing SUMMARY.md)

```
npm run typecheck && npm run lint && npm test
npx expo export --platform android          # JS bundle still clean
eas whoami                                  # confirm user logged in; STOP if not
eas build --platform android --profile development --non-interactive --wait
```

- Capture the EAS build URL, build ID, and final status in SUMMARY.md. The
  build MUST succeed; if it fails, read the EAS build logs, fix config-level
  causes, and retry **at most once** (two failed builds = blocked, report).
- On-phone runtime verification (real photo, segmentation quality, recolor
  latency) is done by the USER after sideloading — list precisely what the
  user should check in SUMMARY.md ("Verification requests for the user"
  section): install via the QR link, pick a portrait photo, confirm hair —
  not face — recolors, note seconds from photo pick to first recolor, try
  the Mock↔TFLite toggle.

### 5. Commit

Stage everything including the previous `docs/SUMMARY.md` state, one commit:
`Iteration 4: real hair segmentation (fast-tflite), EAS dev build`.
Then overwrite `docs/SUMMARY.md` with the Iteration-4 report (left
uncommitted), same five sections as before, plus the new "Verification
requests for the user" section.

## Hard constraints

- Do not edit `docs/HANDOFF.md`, `docs/PROGRESS.md`, or `.claude/`.
- No hand-written Swift/Kotlin (D2). If fast-tflite is genuinely
  incompatible, STOP and report rather than improvising.
- Never run `eas login`, never handle Expo credentials, never create an Expo
  account; `eas whoami` is the only auth interaction allowed.
- The model file is bundled; the app itself makes no network calls at
  runtime. No analytics.
- Do not push to any git remote, do not create a GitHub repo. (The `eas
  build` source upload to Expo's build service is expected and allowed —
  decision D7.)
- Stay within one EAS build (one retry max).
