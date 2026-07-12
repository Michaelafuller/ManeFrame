# ManeFrame — Progress Log

## Product definition (settled 2026-07-10)

An offline, on-device hair-color simulator with a curated hairstyle catalog and
local natural-language filtering. Zero recurring infrastructure cost. All
inference on device. No accounts, no cloud, no analytics.

## Loop protocol

1. **Fable 5 plans** — writes/overwrites `docs/HANDOFF.md` with a self-contained
   work order for one iteration.
2. **Sonnet 5 executes** — implements exactly the handoff scope, then writes
   `docs/SUMMARY.md` (work done, deviations, verification command outputs, file
   inventory, known issues).
3. **Fable 5 reviews** the summary *and independently verifies* (reads code,
   re-runs checks).
   - **Accept** → Fable appends an entry to this file, plans the next handoff.
   - **Reject** → Fable writes `docs/REMEDIATION.md`; Sonnet executes it and
     re-drafts `docs/SUMMARY.md`; review repeats.

Sonnet must never edit `HANDOFF.md`, `REMEDIATION.md`, or this file.

## Key architecture decisions (Fable 5, deviating from the original GPT plan)

- **D1 — Android-first.** Host machine is Windows 11; local iOS builds are
  impossible (no Xcode). All code stays cross-platform, but only Android (and
  Expo Go / emulator where feasible) is built and verified. iOS later via a Mac
  or EAS Build.
- **D2 — `react-native-fast-tflite` instead of hand-written MediaPipe
  Swift/Kotlin wrappers.** Google ships the hair-segmentation model as a
  `.tflite` file; fast-tflite loads it from JS/JSI with GPU delegates and
  integrates with VisionCamera frame processors. This removes nearly all custom
  native code. Hand-rolled MediaPipe wrappers remain a fallback only if model
  output quality disappoints.
- **D3 — Segmentation behind an interface with a mock implementation.** All UI,
  catalog, parser, and color work must run in the Android emulator / Expo Go
  with a `MockHairSegmenter`. Native dev builds are only required for the real
  segmenter.
- **D4 — Phase order: pure-TS first.** Catalog → parser → color math → still
  photo (mock) → real segmentation on still photo → live camera. Live-video
  Skia frame processors are the riskiest dependency and come last.
- **D5 — Still-photo recoloring needs no frame processors.** Decode photo → run
  tflite once → composite with Skia. Much lower risk than the original plan
  implied.
- **D6 — Local git repository** with one commit per accepted iteration, so each
  review can diff exactly what an iteration changed. Local only; nothing is
  pushed.
- **D7 — EAS Build for native builds (2026-07-10, supersedes local Gradle
  plan).** Dev-client APKs are built on EAS cloud workers from app.json via
  Continuous Native Generation — no local prebuild, no local Gradle/NDK, no
  `android/` in the repo, and sideload via internal-distribution QR (no USB
  debugging). Free tier: 15 Android builds/month, 45-min timeout — ample,
  since native rebuilds are only needed when native deps change; day-to-day
  JS iteration runs through Metro over Wi-Fi against the installed dev
  client. Trade-off accepted: each build uploads project source to Expo's
  build service (no secrets in repo; the shipped app remains fully offline).
  Login/account are user-only actions; agents may only run `eas whoami` and
  `eas build`.

## Milestone roadmap

- **M1** — Scaffold: Expo TS app, tooling (tsc/eslint/jest), domain types,
  seed color + hairstyle catalogs with integrity tests. ← *current*
- **M2** — Query parser (synonyms, weighted scoring) + color math (RGB↔Lab,
  luminance-preserving recolor as pure TS) with unit tests.
- **M3** — Still-photo screen: pick/take photo, `MockHairSegmenter`, Skia
  recolor rendering; verified in the Android emulator.
- **M4** — Real segmentation: fast-tflite + hair-segmentation model on still
  photos in a dev build.
- **M5** — Live recoloring: VisionCamera frame processor, temporal smoothing,
  performance presets.
- **M6** — Hairstyle overlays (layered 2D, Level-2 approach) + combined
  style/color query parsing.

## Iteration log

*(entries appended by Fable 5 on acceptance)*

### Iteration 1 — ACCEPTED (2026-07-10) — M1 complete

- Commit `0bbec82`: Expo SDK 57 blank-TS scaffold (RN 0.86, React 19.2), strict
  TS, ESLint 9 flat config + eslint-config-expo, jest-expo, prettier.
- Domain types (`HairColor`, `Hairstyle`), seed catalogs (40 colors / 16
  styles), hand-rolled validation with frozen/cached loaders, 22 passing tests.
- Reviewer verification (independent re-run): typecheck clean; lint 0 errors /
  3 warnings (`Array<T>` style in types.ts — caused by handoff-specified
  shapes, to be normalized to `T[]` in Iteration 2); 22/22 tests; catalog data
  plausibility spot-checked (natural L 9→80 monotonic, pastels gated by
  `minimumRecommendedStartingLevel`); `expo export --platform android` bundles
  cleanly (582 modules).
- Notable executor deviation (accepted): scaffold-move path mishap was
  self-corrected and fully disclosed in SUMMARY.md; template extras
  (AGENTS.md, LICENSE, template .git) deliberately excluded.
- Carry-forward: Lab/opacity/highlightRetention values are hand-authored
  placeholders, to be sanity-checked when M2 color math consumes them.

### Iteration 2 — ACCEPTED (2026-07-10) — M2 complete

- Commit `20711ee`: Lab colorimetry (`src/color/lab.ts`), depth model,
  luminance-preserving `recolorPixel` (settled 5-step model implemented
  verbatim), query parser + weighted scorer, minimal SearchScreen UI.
- Reviewer verification (independent re-run): typecheck clean, lint 0/0,
  88/88 tests, `expo export --platform android` bundles (586 modules);
  `recolor.ts` read line-by-line against the spec — conforms.
- Two disclosed test softenings accepted as legitimate: (a) seed catalog has
  no short+curly style, so canonical query 2 can't have a literal
  short+curly top result; (b) additive scoring means "every result is
  shoulder-length" can't hold literally for query 1. Both trace to
  planner-side spec/data gaps, not executor shortcuts.
- Carry-forward: add a short+curly hairstyle to the catalog (Iteration 3) and
  tighten the query-2 test back to a literal top-result assertion;
  loose substring attribute matching in scorer.ts is fine at 16 styles but
  should be tightened if the catalog grows.
- Environment note: no Android AVD or physical device available on this
  machine — visual verification stays at bundler/unit-test level until the
  user provides one.

### Iteration 3 — ACCEPTED (2026-07-10) — M3 complete

- Commit `b5baf8e`: MockHairSegmenter (deterministic soft elliptical mask,
  11 tests), CPU `recolorImage` + chunked/cancellable variant (6 tests),
  PreviewScreen (picker → downscale → Skia decode → segment → recolor →
  Skia re-encode, press-and-hold before/after, intensity presets),
  two-tab app shell, catalog grown to 18 styles (short+curly gap closed),
  UI smoke tests. Deps added: @shopify/react-native-skia 2.6.2,
  expo-image-picker, expo-image-manipulator (+ @testing-library/react-native
  dev-dep). Everything remains Expo Go-compatible; no prebuild.
- Reviewer verification (independent re-run): 107/107 tests, typecheck/lint
  clean, `expo export --platform android` bundles (857 modules). STOP
  condition (Skia breaking Metro) not triggered — D3 stands.
- Executor deviation of note (accepted, and a genuine spec fix): the recolor
  memo key includes the confidence sample, because `recolorPixel` output
  depends on confidence — the handoff's color-only key would have produced
  wrong colors along soft mask edges.
- Milestone significance: **Phase 1 of the settled plan (still-photo
  recoloring, fully offline) is code-complete**, verified to the limit of
  available hardware (no device/emulator on this machine).
- Carry-forwards for M4: add picker/manipulator to app.json plugins when
  prebuild happens; on-device check of `readPixels` returning Uint8Array;
  measure chunked-recolor timing on real hardware; watch for memo banding
  with a real (non-smooth) segmentation mask.

### Iteration 4 — ACCEPTED (2026-07-11) — M4 code-complete, on-device verification pending

- Commit `33c50f2`: Google `hair_segmenter.tflite` bundled (781,618 bytes,
  SHA-256 `2628cf3c…9bf84`, canonical Google storage URL, verified
  independently by reviewer), `TfliteHairSegmenter` behind the existing
  interface with runtime shape checks and fallback-to-mock + badge/dev
  toggle, pure-TS bilinear resize + tensor→mask conversion (handles both
  1-channel confidence and 2-channel logits layouts), eas.json / metro
  assetExts / app.json plugins, EAS project created
  (`cdefda41-c6d1-4f3c-94ef-3b513c66b2ce`). 19 new tests → 126 total.
- **EAS dev-client build succeeded first attempt** (D7 validated): build
  `b2445fad-8ab2-43b9-9031-74668d1826f4`, ~9m44s, 1 of 15 monthly builds
  used.
- Standout executor work (accepted): hand-parsed the .tflite FlatBuffer to
  discover the undocumented 4th input channel (previous-frame mask,
  zero-filled for stills) and that the output is raw 2-class logits needing
  client-side softmax — the docs alone would have produced a malformed
  input. `expo-dev-client` added as a structurally required dep (disclosed).
- Reviewer verification: model hash/size match exactly, 126/126 tests,
  typecheck/lint clean, EAS build status FINISHED confirmed via
  `eas build:list`. Also confirmed commit `65d2946` ("main -- init commit")
  was authored by the user directly, not an agent — benign docs commit.
- **Gate: M5 (live camera) must not start until the user completes the
  on-device checklist** in the Iteration-4 SUMMARY.md (badge says "tflite",
  recolor tracks hair not face, rough latency, toggle works). Segmentation
  quality/latency findings decide whether M5 proceeds as planned or a
  remediation iteration tunes the mask pipeline first.

### Iteration 4R (4R → 4R-2 → 4R-3) — ACCEPTED (2026-07-11) — launch crash fixed, E2E green

- **Rejection trigger:** Iteration 4's APK crashed instantly on the user's
  phone. Root cause (planner-diagnosed, device-confirmed):
  `react-native-fast-tflite` v3 is a Nitro Module; its peer dependency
  `react-native-nitro-modules` was auto-installed by npm but absent from
  package.json, so Expo autolinking never built the Nitro core into the APK.
- Commits `a285532`/`fbc0697` (4R/4R-2) + `ed2014c`/`226f694` (4R-3):
  nitro-modules dependency added; patch-package fix for a second real bug
  (Skia `useVideoLoading` throws at JS import when reanimated is absent);
  Maestro E2E harness (3 flows, `npm run e2e`, docs/E2E.md with two-mode
  protocol adapted from the user's TummyTracker project); safe-area insets
  via `react-native-safe-area-context` (SDK 57 edge-to-edge made the title
  render under the status bar — 4R-2 misdiagnosed this as GPU text
  corruption; planner geometry-matched the "corrupted glyphs" to the
  status-bar clock bounds and re-dumped the a11y tree to refute it).
- Execution was interrupted once by a host-machine crash mid-4R; state was
  reconstructed from the working tree + EAS build fingerprints (the stale
  pre-fix preview build `0cb773cb` explains the "reverted" build the user
  saw).
- **Acceptance evidence (planner-independent):** `npm run e2e` re-run by
  reviewer → 3/3 flows pass on preview build `ffa74b55` installed on the
  attached phone; screenshot confirms correct insets; 126/126 unit tests.
  EAS usage: 5 of 15 monthly builds consumed.
- **Known debt:** dev-client build `68834a2f` is stale (predates
  safe-area-context) — Metro-mode JS loading will error until M5's natural
  dev-client rebuild; documented in docs/E2E.md.
- Gate for M5 unchanged and now unblocked: user's manual segmentation
  checklist (tflite badge, hair-vs-face recolor, latency, toggle) on the
  installed preview build.

### Iteration 4R-4 — ACCEPTED (2026-07-11) — release-build model loading fixed; NEW blocker found

- **User's M5-gate findings (preview `ffa74b55`):** badge stuck on "mock",
  halo-only recolor, toggle apparently inert — all one root cause: TFLite
  never loaded in release builds. `Image.resolveAssetSource` returns an
  Android resource name in release (vs Metro http URL in dev) that
  fast-tflite's native AssetLoader can't open.
- Commits `07a68f0`/`e952e18`/`c4aaae0`: expo-asset `localUri` → `{url}`
  model source (logcat before/after proves the fix); segmentation failures
  now surfaced (badge "tflite failed → mock" + red reason line +
  console.warn chain); photo contain-fit; selected-color name shown next
  to "Color" heading + swatch auto-scroll; flow 03 added. Builds: dev-client
  `32841af6` (un-stales Metro mode), preview `b297b77f` (7 of 15 used).
- **Reviewer verification:** independent `npm run e2e` → 4/4 pass;
  evidence screenshots visually audited (clean, no personal content);
  commits/logcat claims consistent.
- **Privacy incident, handled correctly by executor:** automating the
  library picker on the physical phone surfaced the user's real photos
  (incl. a driver's license). Executor backed out, retained nothing,
  rewrote flow 03 to stop at the picker entry point, and verified via
  camera capture instead. **Standing rule going forward: automated flows
  must never browse the device photo library; camera-capture only.**
- **NEW BLOCKER (next remediation):** with the file finally loading, TFLite
  fails to prepare the graph: unresolved custom op `MaxPoolingWithArgmax2D`.
  The classic MediaPipe hair model needs MediaPipe's custom ops, which
  vanilla TFLite (fast-tflite) doesn't register. Fix: swap to Google's
  `selfie_multiclass_256x256.tflite` (standard-ops Image Segmenter model
  whose class 1 is hair), after verifying its op list is custom-op-free.

### Iteration 4R-5 — ACCEPTED (2026-07-11) — REAL SEGMENTATION RUNS ON-DEVICE

- Commits `19d6417`/`a6f844f`: model swapped to
  `selfie_multiclass_256x256.tflite` (16.4 MB, SHA-256 `c6748b12…07e0e0`,
  canonical Google URL). Op list independently parsed: **zero CUSTOM ops**
  (all builtins); input `[1,256,256,3]` float32; output `[1,256,256,6]`
  raw logits (last op CONV_2D) → client softmax, hair = channel 1.
  Tensor pipeline made shape-driven (`channels`, `hairChannel`,
  `outputsAreProbabilities`); 137/137 tests. Camera permission pre-granted
  via adb + Maestro `permissions:` block (kills the recurring dialog the
  user reported).
- **On-device: badge reads "tflite segmentation" with no error** on both
  dev-client (Metro) and preview build `d5998560` (8 of 15 monthly
  builds); logcat clean of unresolved-ops. Latency ~2–3s pick-to-recolor.
- Reviewer verification: independent `npm run e2e` → 4/4; evidence
  screenshot visually confirmed; op-list findings consistent with code
  comments.
- **Environment finding (reviewer):** host C: drive hit 0 bytes free —
  broke Maestro mid-review and is the leading suspect for the host's
  recurring BSODs. Reviewer freed ~2.8 GB (project APK downloads, npm
  cache); ~17 GB of user temp remains for the user to clean themselves.
- **Milestone: Phase 1 (still-photo recoloring with REAL hair
  segmentation) is functionally complete pending the user's visual
  quality check on their own portraits.** Hair-quality tuning (mask
  feathering, threshold) may warrant a polish iteration after user
  feedback; then M5 (live camera).

### Iteration 4R-6 — ACCEPTED (2026-07-11) — pipeline vindicated, coverage gap closed

- User reported TFLite recolor was a visual no-op on their portraits
  (badge fine, no error). Planner hypotheses: H1 input normalization,
  H2 double-softmax, H3 ArrayBuffer input. **All three refuted** by
  dev-only on-device instrumentation: input tensor sane [0,1]; output
  per-pixel channel sums ≈ -2.3 (raw logits confirmed, client softmax
  correct); on the new bundled CC0 portrait the mask's fraction>0.5 =
  0.1104 and the teal-bold recolor is visibly excellent (evidence
  4r6-portrait-before/after). No-hair control frame → 0.0000. Root cause
  of the user's symptom: the model finds no hair in the user's specific
  photos — cause TBD on retest (EXIF orientation of library picks is the
  planner's prime suspect; see HANDOFF).
- Structural fix for the acceptance hole that let this ship: bundled
  public-domain test portrait (assets/test/portrait.jpg, source/license
  in E2E.md) + __DEV__-only "Load bundled test portrait" button +
  on-screen "hair px: N%" stat + flows-dev/04-portrait-recolor.yaml
  (passed on dev client). Camera-only privacy rule preserved.
- One real bug fixed (a28163f): dev-only hair-fraction stat loop ran in
  release builds too; now __DEV__-guarded.
- Acceptance: preview build `1eac9823` (9 of 15 monthly builds) installed
  on user's phone; 4/4 flows/ green on it; 137/137 unit tests; tsc and
  eslint clean. Commits e86fc93…ef47779.
- **Process note (planner):** the first executor session was lost mid-run
  (transcript casualty of the disk-full incident) after ~530k tokens; a
  continuation agent reconstructed state from git and finished. All work
  survived because the executor committed incrementally — keep doing that.
- Gate: user retest on 1eac9823 (library pick vs fresh camera selfie —
  the comparison discriminates the EXIF hypothesis). Next iteration adds
  a release-visible "no hair detected" hint regardless of outcome.
