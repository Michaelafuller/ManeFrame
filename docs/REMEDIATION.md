# REMEDIATION — Iteration 4R-4 (tflite fails to load in release builds + UX fixes)

**Author:** Fable 5 (planner) · **Executor:** Sonnet 5 · **Date:** 2026-07-11
**Supersedes 4R-3 (accepted and closed). This order addresses the user's
on-device findings from the M5 gate checklist.**

## User findings (preview build `ffa74b55` on their phone)

1. Badge always reads "mock segmentation" — **TFLite never loads**; the
   fallback engages silently. Everything else they saw follows from this:
   the "halo around the head" recolor and "wispy cotton candy" hair are the
   mock's soft ellipse, not the real model.
2. Long-press toggle appears to do nothing — consistent: forcing tflite
   fails → falls back → badge stays "mock". Not a separate bug, but the UI
   must stop hiding the failure reason.
3. Pick-to-recolor latency 1.5–2s — acceptable, no action.
4. UX asks (in scope, cheap): photo not centered/fully visible; selected
   color not identifiable in the Preview screen.

## Planner diagnosis (high confidence — verify with logcat, then fix)

`src/segmentation/tflite.ts` loads the model via
`loadTensorflowModel(hairSegmenterModelAsset, [])` where the asset is a
Metro `require(..)` number. fast-tflite's JS (read
`node_modules/react-native-fast-tflite/lib/module/loadTensorflowModel.js`)
resolves that through `Image.resolveAssetSource(...)` and hands
`asset.uri` to its native `AssetLoader`. In DEV (Metro) that URI is an
`http://.../assets/...` URL and works; in RELEASE builds it's an Android
resource reference that the native loader cannot open → load fails →
`segmentWithFallback` silently swallows the error. The `[]` delegates
argument is correct API usage (v3 takes `TensorflowModelDelegate[]`) — do
not change it.

Useful: fast-tflite `console.log`s "Loading Tensorflow Lite Model …" and
"Resolved Model path: …" even in release — visible in logcat
(`adb logcat -d | grep -i "Resolved Model path"`), right before the
failure. Capture this as evidence before and after the fix.

## Scope

### 1. Fix the model load path

- `npx expo install expo-asset` (if not already a resolvable dependency —
  it is JS-level, riding on expo's existing native modules).
- In `tflite.ts`'s lazy loader: resolve the model with
  `Asset.fromModule(hairSegmenterModelAsset)` → `await asset.downloadAsync()`
  → pass `{ url: asset.localUri }` to `loadTensorflowModel`, throwing a
  descriptive `TfliteSegmentationError` if `localUri` is null. Keep the
  retry-on-failure singleton behavior and `[]` delegates.
- Unit-test the pure part you can (e.g. a small `resolveModelSource`
  helper given a stubbed Asset) — do not exercise real expo-asset in Jest
  beyond a trivial mock.

### 2. Stop hiding segmentation failures

- `segmentWithFallback` already returns `error`; PreviewScreen must now
  (a) `console.warn` the full error chain (message + cause) so logcat
  always has it, and (b) when the fallback engaged, render a one-line
  muted text under the badge: `tflite failed: <error.message>` (truncate
  ~60 chars). When the user long-presses to force tflite and it fails,
  the badge text becomes "tflite failed → mock" so the toggle visibly did
  something.

### 3. UX fixes (user-requested)

- **Photo fit:** render the photo contain-fit (letterboxed, centered) in
  the canvas so the whole photo is always visible — do not attempt face
  detection or pan/zoom gestures this iteration (note pan/zoom as a
  possible later nicety in SUMMARY known-issues).
- **Selected color visibility:** show the selected color's `displayName`
  next to the "Color" heading (e.g. "Color — Dark Copper Blonde"), and on
  mount scroll the swatch row so the selected swatch is visible
  (`scrollTo` with an estimated offset is fine).

### 4. Builds + on-device verification (device required — see note)

The phone was unplugged after the user's manual checks; it should be back.
Check `adb devices` before device steps; if absent when you reach them,
STOP there and report everything staged (code committed, builds done,
device steps listed as pending).

- **Build the development client first** (`--profile development`, build 6
  of 15; it was stale since safe-area-context anyway). Install it, start
  Metro (`adb reverse tcp:8081 tcp:8081`, deep-link), and verify the fix
  live: push a portrait-ish test image to the device
  (`adb push … /sdcard/Pictures/` + media-scan broadcast), pick it in the
  app, and confirm the badge reads "tflite segmentation" and logcat shows
  a successful load. Iterate here (JS-only, free) until it does.
- Then **preview build** (`--profile preview`, build 7 of 15), install,
  and:
  - New Maestro flow `flows/03-photo-tflite.yaml`: tap "Pick a photo" →
    library → select the pushed test image (device-specific system-picker
    steps are acceptable; note that in E2E.md) → assert the badge text is
    "tflite segmentation". 
  - `npm run e2e` — **4/4 flows green** is the acceptance gate.
  - Screenshot evidence: recolored photo with the real (non-ellipse)
    mask, contain-fit letterboxing, selected-color label. READ the pngs.
- Budget: max 3 EAS builds this session, target 2 (one dev + one preview).

### 5. Commit + report

- Commit before each EAS build as established. Suggested messages:
  `Iteration 4R-4: expo-asset model loading, segmentation error surfacing, preview UX`
  and (if needed) `Iteration 4R-4: e2e flow for tflite photo path`.
- Overwrite `docs/SUMMARY.md` (uncommitted): five sections + before/after
  logcat "Resolved Model path" evidence + results.xml + updated
  "Verification requests for the user" (their segmentation-quality
  checklist, now genuinely against the real model).

## Hard constraints

- Do not edit `docs/HANDOFF.md`, `docs/PROGRESS.md`, `docs/REMEDIATION.md`,
  `.claude/`.
- New dependencies: `expo-asset` ONLY. No hand-written native code, no
  local prebuild, no analytics, no runtime network calls (expo-asset's
  `downloadAsync` on a bundled asset is a local copy, not a download).
- Max 3 EAS builds; never touch credentials (`eas whoami`/`eas build`/
  `eas build:list` only). Do not push.
- Only touch `com.maneframe.app` and your own pushed test image on the
  phone.
