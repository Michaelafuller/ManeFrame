# SUMMARY — Iteration 4R-4 (tflite release-build load fix + UX)

**Executor:** Sonnet 5 · **Date:** 2026-07-11
**Work order:** `docs/REMEDIATION.md` (4R-4). Supersedes the 4R-3 SUMMARY.

## Outcome at a glance

| Scope item | Status |
|---|---|
| 1. Fix the model load path (`expo-asset`) | **Done** — verified via logcat: real `file://` URI now resolved (see §4) |
| 2. Stop hiding segmentation failures | **Done** — badge + red error line confirmed live on device |
| 3. UX fixes (photo contain-fit, selected-color visibility) | **Done** — both confirmed live on device |
| 4. Builds + on-device verification | **Done, with one deliberate scope change** — see "What changed from plan" below |
| 5. Commit + report | **Done** (three commits, as permitted) |

**E2E: 4/4 flows pass on preview build `b297b77f-7d88-4800-832f-90916ba93f9e`.**
**EAS builds this session: 2 (dev-client `32841af6`, preview `b297b77f`) — within the 3-build budget, target of 2 met.**

**Important finding (read before treating this as fully closed):** the
Iteration 4R-4 fix itself is proven correct — the tflite model *file* now
loads successfully in a release-mode bundle, which was the entire bug this
iteration was scoped to fix. But fixing it exposed a **second, previously
invisible defect**: the model then fails to *prepare* because of an
unresolved custom TFLite op (`MaxPoolingWithArgmax2D`). Real hair
segmentation still does not run end-to-end on-device. This needs its own
remediation iteration — see "New finding" below.

---

## What changed from plan (read this first)

REMEDIATION.md's scope item 4 called for a new Maestro flow that picks the
pushed test image via the system **library** picker and asserts the badge.
I could not do this safely and stopped partway through, for a reason the
plan didn't anticipate: **on this physical phone, the library-picker
handler is the user's actual Google Photos app**, not a scoped, sandboxed
"system Photo Picker" sheet. While hunting for a safe, deterministic way
to select our one pushed test image (by recency, by folder/album, by
in-app search), I repeatedly landed on screens showing the phone owner's
real personal photos — including, at one point, a photo of their
**driver's license** (visible full-frame with name/address/photo) and
several family photos. No personal data was read, copied, or acted upon;
I backed out immediately each time and did not screenshot or retain
anything containing personal content beyond what was necessarily visible
in Maestro's own transient debug-artifact screenshots, which I have not
included in `docs/evidence/`.

Given the hard constraint "only touch `com.maneframe.app` and your own
pushed test image on the phone," continuing to browse/search the real
photo library to find one specific file was not an acceptable way to
satisfy the letter of that goal. I made the call to stop, and instead:

1. **Rewrote `flows/03-photo-tflite.yaml`** to only automate what's safe:
   opening the picker (proving the entry point + permission flow work)
   and backing out cleanly. It passes, and is flow 4 of the 4/4 result.
2. **Verified the actual fix (tflite model load) via the camera-capture
   path instead of the library picker.** Camera capture creates a
   brand-new photo (in this case, a dark/black frame — the lens wasn't
   pointed at anything in particular) rather than browsing existing ones,
   so it carries none of the same privacy risk, while exercising the
   *exact* code path under test (`PreviewScreen`'s segmentation effect
   doesn't care how the photo arrived). This is how the before/after
   logcat evidence in §4 was captured.
3. Documented both the finding and the workaround in `docs/E2E.md`'s
   coverage table and troubleshooting section, so this isn't silently
   lost.

I believe this is the right tradeoff: the plan's real goal (prove the
expo-asset fix works, with logcat evidence) is fully met; the letter of
"drive the library picker with Maestro" is not, for a good reason.

---

## 1. Work done (scope-item mapping)

### 1. Model load path fix

- `npx expo install expo-asset` → `~57.0.3` (the only new dependency, per
  the hard constraint). Added `expo-asset` to `app.json`'s plugins
  automatically by the installer.
- `src/segmentation/tflite.ts`: new `resolveModelSource(asset)` helper —
  given an `Asset`-like object (`{ localUri, downloadAsync() }`), it calls
  `downloadAsync()` only if `localUri` is not already set, then returns
  `{ url: localUri }`, throwing `TfliteSegmentationError` if `localUri` is
  still null afterward. `loadModel()` now does
  `resolveModelSource(Asset.fromModule(hairSegmenterModelAsset))` then
  `loadTensorflowModel({ url }, [])` — the `[]` delegates argument is
  unchanged, as instructed. A `console.log` mirrors fast-tflite's own
  "Resolved Model path" line (which never fires for the `{ url }` source
  form) so logcat still shows exactly where the model file came from.
- Retry-on-failure singleton behavior preserved unchanged (`modelPromise`
  reset to `null` in the `.catch`).
- Unit tests: `src/segmentation/__tests__/tflite.test.ts`, 3 new tests
  against a stubbed `ModuleAssetLike` (existing `localUri`, `null` →
  `downloadAsync()` populates it, `null` after `downloadAsync()` throws).
  Real `expo-asset` and real inference are never exercised in Jest, per
  the handoff.

### 2. Stop hiding segmentation failures

- `src/segmentation/selectSegmenter.ts`: `SegmentWithFallbackResult` gained
  a `rawError?: unknown` field (the original thrown value, alongside the
  existing flattened `error: string`) so callers can walk the full
  message+cause chain — `error` alone loses `cause`. Existing tests
  unaffected (they only assert `.error`/`.usedFallback`/`.mask`).
- `src/ui/PreviewScreen.tsx`:
  - New `segmentationError` state, set only when `segmentWithFallback`'s
    `usedFallback` is true (never for a deliberate `forceMock` toggle).
  - `console.warn`s the message + `cause` (via `rawError`) whenever
    fallback engages, so logcat always has the full chain.
  - Badge label: `"tflite failed → mock"` when `segmentationError` is set,
    else `"mock segmentation"` / `"tflite segmentation"` as before — so
    the long-press toggle visibly does something even when tflite always
    fails (previously both states rendered identical "mock segmentation"
    text).
  - New muted red line under the badge: `tflite failed: <message>`,
    truncated to ~60 chars.

### 3. UX fixes

- **Photo contain-fit:** the `SkiaImage` draw rect previously used
  `photo.width`/`photo.height` (the decoded photo's *pixel* dimensions,
  often >768px) as the Canvas-space rect size. Since the Canvas's actual
  on-screen size is much smaller, this meant the image was drawn hugely
  oversized relative to the visible viewport — effectively zoomed in/
  cropped, matching the user's "photo not fully visible" complaint. Fixed
  by measuring the wrapping `View`'s real layout size via `onLayout` and
  using that (`canvasLayout.width`/`height`) for the draw rect instead,
  with `fit="contain"` kept as a no-op safety net (the wrapper's
  `aspectRatio` already matches the photo's, so contain is normally an
  exact fit).
- **Selected color visibility:** the "Color" section heading now reads
  `"Color — <displayName>"` (e.g. "Color — Level 4 Natural Medium Dark
  Brown"); the swatch `ScrollView` scrolls to the selected swatch's
  estimated offset (`index * 74dp`) on `onContentSizeChange` (i.e. on
  mount, once the row has laid out).
- Pan/zoom is explicitly out of scope this iteration (noted as a future
  nicety below), per the handoff.

### 4. Builds + on-device verification

- **Dev-client build** `32841af6-06b2-45d8-97e4-b6c0e4351952` (build 6 of
  15 monthly), FINISHED. Installed; Metro started on port **8082** (8081
  was held by a stale `node.exe` process from a prior session that this
  session's sandbox couldn't `taskkill` - documented, not fought further).
  Deep-linked in via
  `exp+maneframe://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8082`.
  **Both UX fixes (§3) confirmed visually live**: `docs/evidence/4r4-color-label-swatch-scroll.png`
  shows "Color — Level 4 Natural Medium Dark Brown" and the swatch row
  pre-scrolled to the selected (bordered) swatch.
- **Preview build** `b297b77f-7d88-4800-832f-90916ba93f9e` (build 7 of
  15), FINISHED, installed. `npm run e2e` → **4/4 flows pass** (see §5 for
  the flow-03 scope change).
- **Logcat evidence — before vs. after (the core ask for this
  iteration):**

  Before the fix, reinstalling the last-accepted preview build
  (`ffa74b55`, predates this iteration) and picking a photo via the
  camera:
  ```
  ReactNativeJS: Loading Tensorflow Lite Model 1
  ReactNativeJS: Resolved Model path: assets_models_hair_segmenter
  ```
  No further tflite log ever appears for the app's process — the native
  `AssetLoader` silently fails to open that Android-resource-style name
  outside DEV, exactly as diagnosed. The badge reads **"mock
  segmentation"** with no error surfaced (`docs/evidence/4r4-badge-before-mock-hidden.png`
  — this is the exact bug the user reported).

  After the fix, same physical device, same camera-capture procedure,
  fixed preview build `b297b77f`:
  ```
  ReactNativeJS: [tflite] Resolved model localUri (expo-asset): file:///data/user/0/com.maneframe.app/cache/ExponentAsset-1effac57961bd80e59011dc99bd00cc1.tflite
  tflite: Initialized TensorFlow Lite runtime.
  tflite: Encountered unresolved custom op: MaxPoolingWithArgmax2D.
  tflite: Node number 12 (MaxPoolingWithArgmax2D) failed to prepare.
  ReactNativeJS: '[PreviewScreen] tflite segmentation failed, falling back to mock:', 'Failed to load the hair segmentation model.', '\ncause: Error: TfliteModule.createModel(...): TFLite: Failed to allocate memory for input/output tensors! Status: unresolved-ops'
  ```
  The model **file now resolves to a real local path and loads into the
  TFLite runtime** — the release-build asset-resolution bug (this
  iteration's actual scope) is fixed and verified. The badge now honestly
  reads **"tflite failed → mock"** with the red line **"tflite failed:
  Failed to load the hair segmentation model."** underneath
  (`docs/evidence/4r4-badge-after-error-surfaced.png`) — proving the
  error-surfacing fix (§2) also works, and that the long-press toggle now
  visibly does something.

  See "New finding" below for what the `MaxPoolingWithArgmax2D` line
  means and why it's a distinct, follow-on issue.

---

## 2. New finding: unresolved custom op blocks real segmentation (carry-forward)

Independent of and downstream from this iteration's fix: `hair_segmenter.tflite`
(the model bundled in Iteration 4) contains a node using the custom op
`MaxPoolingWithArgmax2D` (a pooling-with-indices op common in
segmentation/unpooling architectures). The stock TFLite interpreter that
`react-native-fast-tflite` bundles only ships the standard `BUILTIN` op
set and does not resolve this op, so `TfliteModule.createModel(...)`
throws `Status: unresolved-ops` at prepare time, every time, on this
device. This was never visible before because the model never got past
asset resolution in a release build (this iteration's bug) — Iteration 4's
dev-client build was never actually put through end-to-end inference in a
release-style bundle either, so this is a genuinely new, previously-latent
finding, not something 4R-4 broke.

Likely remediation paths for whoever picks this up (not attempted here -
out of scope, needs its own planning): (a) a TFLite build/delegate with
Select-TF-ops (`flex`) support that can resolve `MaxPoolingWithArgmax2D`,
if `react-native-fast-tflite` exposes one; (b) re-export/convert the
hair-segmentation model to avoid that op (e.g. a build targeting only
standard ops); (c) fall back to the hand-rolled MediaPipe wrapper path
noted as a fallback option back in `docs/PROGRESS.md`'s D2. This blocks
the M5 gate exactly as the existing gate condition already anticipates
("segmentation quality/latency findings decide whether M5 proceeds") —
segmentation doesn't run at all yet, so M5 should not start.

---

## 3. Deviations from the handoff (disclosed)

- **Flow 03 scope**: does not select a photo via the library picker (see
  "What changed from plan"). It verifies the picker entry point only;
  the badge/tflite-load assertion was verified out-of-band via camera
  capture + logcat instead of via this flow's own assertion.
- **Metro port**: 8081 was held by a stale process this session couldn't
  kill (`taskkill` access denied); used `--port 8082` throughout instead,
  with `adb reverse tcp:8082 tcp:8082` and the matching deep link. Noted
  per the standing instruction to record what was done when a stale
  Metro interferes.
- A temporary `global.__debugTflite` hook was added to `App.tsx` during
  investigation (to attempt CDP/Hermes-debugger-based verification before
  the camera-capture approach was found) and **fully reverted** before any
  commit — `git diff App.tsx` against the last commit is empty.

---

## 4. Verification commands run

```
npx tsc --noEmit                     # clean
npx eslint .                         # 0 errors / 0 warnings
npx jest                             # 129/129 passed (126 + 3 new tflite.test.ts)
npx expo export --platform android   # bundles cleanly, 890 modules
npm run e2e                          # 4/4 flows pass (preview build b297b77f)
```

---

## 5. File inventory (this iteration)

- `src/segmentation/tflite.ts` — expo-asset resolution, `resolveModelSource`,
  `ModuleAssetLike` type, evidence log line.
- `src/segmentation/selectSegmenter.ts` — `rawError` field.
- `src/segmentation/__tests__/tflite.test.ts` — new, 3 tests.
- `src/ui/PreviewScreen.tsx` — error surfacing (badge + red line + console.warn),
  canvas-layout-based contain-fit, selected-color heading, swatch auto-scroll.
- `flows/03-photo-tflite.yaml` — new, entry-point-only (see deviations).
- `docs/E2E.md` — coverage table + troubleshooting entries updated for the
  above.
- `docs/evidence/4r4-badge-before-mock-hidden.png`,
  `4r4-badge-after-error-surfaced.png`, `4r4-color-label-swatch-scroll.png` —
  new evidence screenshots.
- `app.json`, `package.json`, `package-lock.json` — `expo-asset` dependency
  + config plugin.

---

## 6. Known issues / carry-forwards

- **Blocking, new (§2 above):** `MaxPoolingWithArgmax2D` unresolved custom
  op prevents the tflite model from actually preparing/running, on top of
  (now fixed) asset resolution. Real hair segmentation does not work
  end-to-end yet. Needs its own remediation.
- Pan/zoom for photo framing noted as a possible later nicety (not
  attempted, per handoff).
- The library-photo-picker step in `flows/03-photo-tflite.yaml` remains
  manual-only, now for a documented safety reason (not just a tooling
  gap) — see `docs/E2E.md`.
- Dev-client build `32841af6` and preview build `b297b77f` both carry this
  iteration's fixes; the dev-client is therefore no longer stale (unlike
  the note carried from 4R-3).

---

## Verification requests for the user

Once you're comfortable, a couple of things worth checking yourself (the
segmentation-quality checklist is currently moot until the new
`MaxPoolingWithArgmax2D` issue is fixed — the badge will honestly read
"tflite failed → mock" for every photo until then):

1. **UX fixes**: pick a photo and confirm (a) it's fully visible,
   centered/letterboxed, not zoomed/cropped; (b) the "Color" heading shows
   your selected color's name and the swatch row is already scrolled to
   it.
2. **Error surfacing**: confirm the badge now reads "tflite failed → mock"
   (not a silent "mock segmentation") and that a red line under it names
   the failure.
3. Once a follow-up iteration resolves the custom-op issue, the original
   segmentation-quality checklist (badge says real tflite, mask tracks
   hair not face, rough latency, toggle works) becomes meaningful again.
