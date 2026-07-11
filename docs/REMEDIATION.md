# REMEDIATION — Iteration 4R-5 (swap to a standard-ops segmentation model)

**Author:** Fable 5 (planner) · **Executor:** Sonnet 5 · **Date:** 2026-07-11
**Supersedes 4R-4 (accepted). This order removes the last blocker between
the user and real on-device hair segmentation.**

## Context

4R-4 proved the model *file* loads in release builds, which exposed the
real terminal blocker: `hair_segmenter.tflite` is the classic MediaPipe
hair model and requires MediaPipe's custom TFLite ops
(`MaxPoolingWithArgmax2D` et al.). `react-native-fast-tflite` runs vanilla
TFLite and cannot register custom ops without hand-written native code —
which decision D2 forbids. The model must be swapped, not the runtime.

**Replacement:** Google's MediaPipe Image Segmenter multiclass model
`selfie_multiclass_256x256.tflite` (canonical URL pattern:
`https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite`,
Apache-2.0). Its categories are `0 background, 1 hair, 2 body-skin,
3 face-skin, 4 clothes, 5 others` — channel 1 is exactly what we need, and
as a bonus the face-skin channel may be useful later. Expect ~16 MB (vs
782 KB) — acceptable; note the app-size impact in SUMMARY.

## Scope

### 1. Acquire + VERIFY the model before wiring anything

- Download from the canonical URL (verify against the MediaPipe image
  segmenter docs; if dead, STOP). Record URL, size, SHA-256.
- **Parse the .tflite FlatBuffer op list BEFORE integrating** (reuse the
  4R FlatBuffers-reader technique): every operator must be a TFLite
  builtin — zero `CUSTOM` ops. If any custom op exists, STOP and report
  (do not hunt for alternative models on your own).
- While parsed, record: exact input shape/type, output tensor shape(s)/
  type(s), and whether the graph's final op is `SOFTMAX` (i.e. outputs are
  probabilities) or not (logits needing client-side softmax). Put this in
  SUMMARY like 4R did — it drives the tensor code below.

### 2. Wire it in (shape-driven, not hardcoded)

- Replace `assets/models/hair_segmenter.tflite` with the new model file
  (delete the old one — it can never run under D2).
- `src/segmentation/tensor.ts`:
  - `buildSegmenterInputTensor` gains a `channels` parameter (3 or 4)
    driven by the model's runtime-reported input shape; 3-channel input =
    plain normalized RGB, no previous-mask channel.
  - `tensorToHairMask` gains an explicit `hairChannel` (default 1) and an
    `outputsAreProbabilities` flag: when true, take channel `hairChannel`
    clamped 0..1 (no softmax); when false, softmax as today. Both paths
    unit-tested with synthetic tensors (extend to a 6-channel case).
- `src/segmentation/tflite.ts`: accept input shapes `[1,N,N,3]` or
  `[1,N,N,4]`; wire the probabilities flag from what step 1 determined
  (hardcode the determination for THIS model with a comment citing the op
  list; keep the loud `TfliteSegmentationError` on anything unexpected).
- Update all affected unit tests + the SHA-256 note in code comments if
  present. Full local suite green.

### 2b. Kill the recurring permission prompts (user-reported annoyance)

- Pre-grant permissions non-interactively before any automated launch:
  `adb shell pm grant com.maneframe.app android.permission.CAMERA` (and
  the media/read-images permission if the app declares one — check
  `adb shell dumpsys package com.maneframe.app | grep permission`).
- Bake this into the flows (Maestro `launchApp` supports a `permissions:`
  block — use it in 03-photo-tflite) AND document the adb one-liner in
  docs/E2E.md so manual sessions don't hit the dialog either.

### 3. Verify on-device via dev client + Metro (free iteration — no build yet)

- Dev client `32841af6` is CURRENT (model swap is a JS/asset change; no
  native fingerprint change — do NOT rebuild the development profile).
- Metro + `adb reverse` + deep link (recipe in docs/E2E.md). Use the
  **camera-capture path only** — **standing rule from PROGRESS.md: never
  browse or search the device photo library in any automated flow; the
  4R-4 privacy incident is why.** Confirm:
  - Badge reads "tflite segmentation" (no red error line).
  - Logcat shows the model preparing + inferring without `unresolved-ops`.
  - The recolor visibly follows something plausibly hair-shaped rather
    than the mock's centered ellipse (point the camera at anything;
    perfect quality judgment stays with the user — but capture a
    screenshot pair mock-vs-tflite of the same capture via the long-press
    toggle as evidence that the mask actually changed).
  - Note observed pick-to-recolor latency vs the ~1.5–2s CPU baseline
    (256×256 input should be faster than the old 512×512 path).

### 4. One preview build + green E2E

- Commit, then `eas build --platform android --profile preview
  --non-interactive` (build 8 of 15; max one retry). Download,
  `adb install -r`, `npm run e2e` → **4/4 required** (flow 03 remains
  entry-point-only; do not extend it into the library).
- Evidence: screenshot on the preview build showing "tflite segmentation"
  badge on a camera capture.

### 5. Commit + report

- Suggested messages: `Iteration 4R-5: selfie_multiclass model, shape-driven
  tensor pipeline` (+ optional small follow-up commit for e2e/evidence).
- Overwrite `docs/SUMMARY.md` (uncommitted): five sections, the op-list/
  I/O determination, before/after logcat, results.xml, evidence, and
  "Verification requests for the user" — their real segmentation-quality
  checklist on their own portrait photos (manually, via their own library
  picking — fine when THEY do it), plus a note on the APK size change.

## Hard constraints

- Do not edit `docs/HANDOFF.md`, `docs/PROGRESS.md`, `docs/REMEDIATION.md`,
  `.claude/`.
- No new dependencies at all. No hand-written native code, no prebuild.
- **Never open, browse, or search the device photo library from automation;
  camera-capture only.** Only touch `com.maneframe.app` and content your
  automation creates.
- Max 2 EAS builds (preview only; the dev client must NOT be rebuilt).
- Never touch credentials; `eas whoami`/`eas build`/`eas build:list` only.
- No push, no analytics, no runtime network calls.
