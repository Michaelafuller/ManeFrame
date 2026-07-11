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
