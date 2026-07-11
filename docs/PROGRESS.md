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
