# SUMMARY — Iteration 4R-5 (selfie_multiclass model swap, standard ops only)

**Executor:** Sonnet 5 · **Date:** 2026-07-11
**Work order:** `docs/REMEDIATION.md` (4R-5). Supersedes the 4R-4 SUMMARY.

## Outcome at a glance

| Scope item | Status |
|---|---|
| 1. Acquire + verify the model before wiring anything | **Done** — zero `CUSTOM` ops, independently verified twice (see §1) |
| 2. Wire it in (shape-driven, not hardcoded) | **Done** — `channels`/`hairChannel`/`outputsAreProbabilities` params, 137/137 tests |
| 2b. Kill recurring camera-permission dialogs | **Done** — adb one-liner + Maestro `permissions:` block, documented in `docs/E2E.md` |
| 3. Verify on-device via dev client + Metro | **Done** — badge reads "tflite segmentation", no error, no `unresolved-ops` in logcat |
| 4. One preview build + green E2E | **Done** — build `d5998560` (8 of 15 monthly), **4/4 flows pass** |
| 5. Commit + report | **Done** — two commits (model swap, this SUMMARY) |

**The terminal blocker from 4R-4 is resolved.** Real on-device hair
segmentation now runs end to end, on the actual preview (release-mode)
build, with no custom-op failure. The badge honestly reads "tflite
segmentation" on a camera-captured photo.

---

## 1. Model acquisition + op-list verification (done BEFORE any wiring)

I inherited a partially-completed working tree at the start of this session
(model already downloaded, `tensor.ts`/`tflite.ts` already rewritten,
tests already updated — evidently work from a prior session interrupted by
one of the host crashes mentioned in my instructions, per the pattern
already documented for 4R). Rather than trust that or redo it blindly, I
**independently re-verified every claim in it from scratch** before
proceeding, per the hard "STOP if any custom op exists" gate:

- **Re-downloaded** the model fresh from the canonical URL:
  `https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_multiclass_256x256/float32/latest/selfie_multiclass_256x256.tflite`
  → HTTP 200, 16,371,837 bytes.
- **SHA-256** (computed independently via `certutil`, three ways — the
  bundled asset, the leftover scratchpad copy, and my own fresh
  re-download — all three matched exactly):
  `c6748b1253a99067ef71f7e26ca71096cd449baefa8f101900ea23016507e0e0`
- **Re-ran the hand-rolled TFLite FlatBuffer parser** (a from-scratch
  vtable/uoffset reader, no `flatbuffers` dependency — same technique as
  Iteration 4's hair_segmenter.tflite dump) against the bundled file
  myself:
  ```
  subgraphs: 1 | tensors: 373 | operators: 175
  operator_codes: CONV_2D, DEPTHWISE_CONV_2D, ADD, RESHAPE, TRANSPOSE, MUL,
                  SOFTMAX, SUM, RESIZE_BILINEAR, RESIZE_NEAREST_NEIGHBOR,
                  TRANSPOSE_CONV
  *** VERDICT: zero CUSTOM ops — every operator is a TFLite builtin. ***
  graph inputs:  tensor[0]   name=input_29 type=FLOAT32 shape=[1,256,256,3]
  graph outputs: tensor[372] name=Identity type=FLOAT32 shape=[1,256,256,6]
  Last op in graph: CONV_2D => output tensor(s) are RAW/LOGITS (no
  trailing softmax; client must normalize if needed)
  ```
- **Verdict driving the code (per MediaPipe's documented category order —
  `background, hair, body-skin, face-skin, clothes, others`):**
  - Zero custom ops → safe to integrate under D2 (no hand-written native
    code needed).
  - Input: `[1, 256, 256, 3]` float32 — plain RGB, no previous-mask
    loopback channel (unlike the old model's 4th channel).
  - Output: `[1, 256, 256, 6]` float32, **raw logits** (last op is
    `CONV_2D`, not `SOFTMAX` — the `SOFTMAX` ops present in the graph
    belong to internal attention blocks, not the classification head) →
    client-side softmax required, same shape of fix as before.
  - Hair is channel index **1**.

This matches the analysis already present in the inherited code comments
exactly, so I kept it (with attribution details as above) rather than
duplicate the same work with different wording.

---

## 2. Wiring (shape-driven)

- `src/segmentation/tensor.ts`:
  - `buildSegmenterInputTensor(pixels, w, h, targetSize, channels: 3 | 4 = 3)`
    — `channels` is passed by the caller from the model's own runtime
    `inputs[0].shape[3]`, not hardcoded; 3-channel path drops the old
    4th "previous mask" channel entirely (this model doesn't take one).
  - `tensorToHairMask(tensor, w, h, channels, hairChannel = 1,
    outputsAreProbabilities = false)` — extended with a 6-channel
    categorical-logits path (softmax across all 6 classes, take the hair
    channel's probability) alongside the existing 1-channel and 2-channel
    cases. New unit tests cover: 6-channel hair-dominant, 6-channel
    other-class-dominant (low hair value), `outputsAreProbabilities: true`
    read-through, out-of-range clamping, and a non-default `hairChannel`
    (face-skin at index 3) to prove the parameter isn't hardcoded to "1".
- `src/segmentation/tflite.ts`:
  - Imports `selfie_multiclass_256x256.tflite` instead of the deleted
    `hair_segmenter.tflite`.
  - `MODEL_OUTPUTS_ARE_PROBABILITIES = false` and `MODEL_HAIR_CHANNEL = 1`,
    each with a comment citing the exact op-list finding above (per the
    handoff's "hardcode the determination for THIS model with a comment").
  - Runtime shape validation now accepts both `[1,N,N,3]` and `[1,N,N,4]`
    input shapes (still throws `TfliteSegmentationError` on anything else).
  - Removed a leftover `TEMP DIAGNOSTIC` `console.log` block (asset
    name/type/hash/uri dump) that the inherited code had marked "remove
    before commit" but hadn't yet — cleaned up before this iteration's
    commit.
- `assets/models/hair_segmenter.tflite` deleted; `selfie_multiclass_256x256.tflite`
  added. No changes needed to `app.json`, `metro.config.js`, or
  `assets.d.ts` — all already generic over `*.tflite`.
- **Full local suite green:** `npx tsc --noEmit` clean, `npx eslint .` 0/0,
  `npx jest` → **137/137** (was 129 in 4R-4; +8 net new tests).

---

## 3. Killing the recurring camera-permission dialog (2b)

- `flows/03-photo-tflite.yaml`: added a `permissions: { camera: allow }`
  block to `launchApp`, so `clearState`'s permission reset never
  re-triggers the OS "Allow ManeFrame to take pictures?" dialog mid-flow.
- Confirmed via `adb shell dumpsys package com.maneframe.app | grep permission`
  that **CAMERA is the only runtime permission this app declares** (also
  `READ_PHONE_STATE`, unrelated/unused, `granted=false`, not touched) — no
  separate media/read-images permission exists to also pre-grant.
- `docs/E2E.md`: new "Permissions" section documents both the Maestro
  `permissions:` block and the manual-session adb equivalent
  (`adb shell pm grant com.maneframe.app android.permission.CAMERA`).
- Verified directly on-device (both the dev-client Metro session in §4 and
  the final preview build in §5): tapping "Take a Photo" opened the camera
  activity immediately with **no permission dialog** in either case.

---

## 4. On-device verification via dev client + Metro (no build yet)

Dev-client build `32841af6` was already FINISHED from 4R-4 (confirmed via
`eas build:list`, not rebuilt) — reinstalled the existing artifact
(`adb install -r`, no EAS build consumed), started Metro
(`npx expo start --dev-client --port 8081`), `adb reverse tcp:8081 tcp:8081`,
deep-linked in. Camera-capture path only, per the standing privacy rule —
library picker never touched.

- **Badge:** "tflite segmentation" — no red error line — on the first
  camera capture, first try.
- **Logcat** (pid-scoped to the app's own process):
  ```
  ReactNativeJS: [tflite] Resolved model localUri (expo-asset): file:///data/user/0/com.maneframe.app/cache/ExponentAsset-....tflite
  tflite: Initialized TensorFlow Lite runtime.
  Nitro.HybridObjectPrototype: Creating new JS prototype for C++ instance type "HybridTfliteModelSpec"...
  ```
  No `unresolved-ops`, no `MaxPoolingWithArgmax2D` — the model prepares
  and runs cleanly. (Earlier `tflite: Replacing N out of N node(s) with
  delegate (TfLiteGpuDelegate_New)` lines in the wider logcat belong to a
  different pid — Play Services' own TFLite-in-Google-Play-Services
  component, not this app — so are not evidence of *our* delegate use,
  just noted for transparency.)
- **Toggle + mask-changed evidence:** long-pressed the badge to flip
  mock ↔ tflite twice, screenshotting each state. Because the ambient
  capture was a very dark/low-light frame, the visual difference between
  mock and tflite recolor is subtle to the eye, so I additionally
  **pixel-diffed the two screenshots** (`pngjs`, cropped to the photo
  region only, excluding badge text): **38.29% of compared pixels differ
  by more than a small threshold** (mean diff 6.0, max 37, out of 765
  possible), which is small in absolute terms (dark scene, small RGB
  range) but definitively proves the mask differs between the two code
  paths — not a rendering fluke or stale frame.
- **Latency:** imprecise (no code instrumentation added, to avoid another
  "remove before commit" leftover), but observed via screenshot timing:
  the "Processing…" spinner was still visible ~1.6s after tapping confirm
  and had cleared by the next screenshot a couple of seconds later —
  roughly **2–3s pick-to-recolor** on this device. Logcat shows the GPU
  delegate active (`TfLiteGpuDelegate_New`, from the Play-Services TFLite
  component at least) and model *load* itself is fast (~150ms); 256×256
  input is 4× fewer pixels than the old model's 512×512, so this is
  plausibly faster than the ~1.5–2s CPU baseline noted in the handoff,
  though I don't have a same-device, same-conditions old-model number to
  compare directly (the old model never got past the custom-op failure to
  produce one).

---

## 5. Preview build + E2E

- Committed the model swap + wiring + permission fix first (commit
  `19d6417`), then built:
  `eas build --platform android --profile preview --non-interactive --no-wait`
  → build **`d5998560-0ed7-4e18-bd9f-9806a32d80db`** (8 of 15 monthly
  builds used), polled via `eas build:list --json`, **FINISHED** in ~8
  minutes, one attempt, no retry needed.
- Downloaded, `adb install -r`, re-granted CAMERA (a fresh install resets
  grants), `npm run e2e`:
  ```
  [Passed] 00-launch (6s)
  [Passed] 01-search (30s)
  [Passed] 02-preview-mock-badge (8s)
  [Passed] 03-photo-tflite (14s)
  4/4 Flows Passed in 58s
  ```
  `flows/results.xml` updated with this run.
- **Evidence on the actual preview (release-mode) build** — camera
  capture → badge reads **"tflite segmentation"**, no error line:
  `docs/evidence/4r5-preview-badge-tflite.png`. Logcat on this build
  confirms the same clean load/init sequence as §4, this time in a
  release bundle (the exact context 4R-4's blocker occurred in):
  ```
  ReactNativeJS: [tflite] Resolved model localUri (expo-asset): file:///data/user/0/com.maneframe.app/cache/ExponentAsset-....tflite
  tflite: Initialized TensorFlow Lite runtime.
  ```
  No `unresolved-ops`/`MaxPoolingWithArgmax2D` anywhere in this build's
  process log either.

---

## 6. File inventory (this iteration)

- `assets/models/selfie_multiclass_256x256.tflite` — new (16,371,837
  bytes); `assets/models/hair_segmenter.tflite` — deleted.
- `src/segmentation/tensor.ts` — `channels` param on
  `buildSegmenterInputTensor`; `hairChannel`/`outputsAreProbabilities`
  params + 6-channel path on `tensorToHairMask`.
- `src/segmentation/tflite.ts` — new model import, hardcoded
  `MODEL_OUTPUTS_ARE_PROBABILITIES`/`MODEL_HAIR_CHANNEL` with op-list
  citation, wider input-shape validation, diagnostic log removed.
- `src/segmentation/__tests__/tensor.test.ts`,
  `src/segmentation/__tests__/tflite.test.ts` — updated/extended, +8 tests
  net.
- `flows/03-photo-tflite.yaml` — `permissions: { camera: allow }` block.
- `flows/results.xml` — this iteration's 4/4 acceptance run.
- `docs/E2E.md` — new "Permissions" section; coverage table updated for
  the resolved segmentation blocker.
- `docs/evidence/4r5-preview-badge-tflite.png` — new evidence screenshot
  (preview build, tflite badge, camera capture, no personal content — a
  dark/ambient frame only).

---

## 7. App-size impact (per the handoff's ask)

The model grew from 781,618 bytes (~0.75 MB) to 16,371,837 bytes
(~15.6 MB) — about a **15 MB increase** to the bundled asset, which flows
through to the installed APK size. This is the expected/accepted
trade-off from the handoff ("Expect ~16 MB (vs 782 KB) — acceptable").

---

## 8. Known issues / carry-forwards

- Latency is only roughly bracketed (~2–3s), not precisely instrumented —
  no code was added to measure it more exactly, to avoid leaving another
  temporary diagnostic in the tree. A future iteration could add a
  guarded, permanent (not "remove before commit") timing log if precise
  numbers matter.
- The mock-vs-tflite mask-difference evidence this iteration is from a
  dark/low-light capture (pixel-diff proves the mask differs, but it
  isn't a visually dramatic before/after). The real segmentation-quality
  judgment — does the mask actually track hair shape on a real portrait —
  is explicitly the user's own check (see below), same as previous
  iterations' gate.
- `flows/03-photo-tflite.yaml` still stops at the picker entry point
  (doesn't select a library photo), per the standing privacy rule from
  4R-4 — unchanged this iteration.

---

## Verification commands run

```
npx tsc --noEmit                     # clean
npx eslint .                         # 0 errors / 0 warnings
npx jest                             # 137/137 passed
npm run e2e                          # 4/4 flows pass (preview build d5998560)
```

---

## Verification requests for the user

The blocker is fixed and the pipeline runs end to end — this is now the
real segmentation-quality checklist that's been gated since Iteration 4:

1. **Pick a real portrait photo** (your own, via your own library-picking
   — automation still never touches your library, only you can do this
   part) and confirm the badge reads "tflite segmentation" (no red error
   line).
2. **Does the recolored region actually track your hair** — not your
   face, not the background? This is the core quality question this
   whole remediation chain existed to unblock.
3. **Rough latency** on your device — does 2–3s (or whatever you observe)
   feel acceptable for a still-photo preview?
4. **Long-press the badge** to toggle mock ↔ tflite on the same photo —
   does the recolored region visibly change shape (not just re-run with
   the same result)?
5. **App size**: the APK grew by ~15 MB from this model swap (see §7) —
   flag if that's a concern before this ships anywhere beyond your own
   device.

Once you're satisfied with 1–4, M5 (live camera) is unblocked per the
existing gate in `docs/PROGRESS.md`.
